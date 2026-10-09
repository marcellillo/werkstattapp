export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { pruefeZugriff } from '@/lib/auftrag-dokumente-server'
import { verlangeRolle, ADMIN_ROLLEN } from '@/lib/rollen-server'
import { rateLimit } from '@/lib/rate-limit'
import { serverFehler } from '@/lib/api-fehler'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/leistungspaket/aus-auftrag  { auftragId, name }
// Speichert die offenen Positionen eines Auftrags (Teile aus dem Kostenvoranschlag, Arbeitszeit aus dem Werkstattauftrag)
// als neues Leistungspaket — so entstehen die ersten Pakete aus echten Aufträgen. Nur Administratoren.
export async function POST(req: NextRequest) {
  const { auftragId, name } = await req.json().catch(() => ({}))
  const paketName = typeof name === 'string' ? name.trim().slice(0, 120) : ''
  if (!UUID.test(auftragId ?? '') || !paketName) return NextResponse.json({ error: 'Auftrag und Name erforderlich' }, { status: 400 })

  const zugriff = await pruefeZugriff(auftragId)
  if ('res' in zugriff) return zugriff.res
  const { supabase, betriebId, userId } = zugriff
  const rolle = await verlangeRolle(supabase, userId, betriebId, ADMIN_ROLLEN, 'Pakete anlegen dürfen nur Administratoren.')
  if (rolle) return rolle
  const limit = await rateLimit(`leistungspaket-neu:${userId}`, 30, 600)
  if (limit) return limit

  try {
    const [{ data: kvs }, { data: was }, { data: cfg }] = await Promise.all([
      supabase.from('kostenvoranschlaege').select('id').eq('betrieb_id', betriebId).eq('auftrag_id', auftragId).is('rechnung_id', null),
      supabase.from('werkstattauftraege').select('id').eq('betrieb_id', betriebId).eq('auftrag_id', auftragId).is('rechnung_id', null),
      supabase.from('betrieb_einstellungen').select('wert').eq('betrieb_id', betriebId).eq('schluessel', 'firma_stundensatz').maybeSingle(),
    ])
    const stundensatz = parseFloat(String(cfg?.wert ?? '').replace(',', '.'))
    const kvIds = (kvs ?? []).map(k => k.id)
    const waIds = (was ?? []).map(w => w.id)
    const [{ data: teile }, { data: arbeiten }] = await Promise.all([
      kvIds.length ? supabase.from('kostenvoranschlag_position').select('beschreibung, menge, einzelpreis').in('kostenvoranschlag_id', kvIds).order('created_at') : Promise.resolve({ data: [] as any[] }),
      waIds.length ? supabase.from('werkstattauftrag_positionen').select('beschreibung, menge, einzelpreis').in('werkstattauftrag_id', waIds).order('created_at') : Promise.resolve({ data: [] as any[] }),
    ])
    if (!(teile?.length || arbeiten?.length)) {
      return NextResponse.json({ error: 'In diesem Auftrag gibt es noch keine Positionen im Kostenvoranschlag oder Werkstattauftrag.' }, { status: 400 })
    }

    const { data: paket, error } = await supabase.from('leistungspakete').insert({ betrieb_id: betriebId, name: paketName }).select('id').single()
    if (error) throw error
    const zeilen = [
      ...(teile ?? []).map((p: any) => ({ art: 'teil', beschreibung: p.beschreibung, menge: Number(p.menge) || 1, einzelpreis: Number(p.einzelpreis) || 0 })),
      // Arbeitszeit zum aktuellen Stundensatz -> kein fester Preis, damit spätere Preisänderungen automatisch gelten
      ...(arbeiten ?? []).map((p: any) => ({
        art: 'arbeit', beschreibung: p.beschreibung, menge: Number(p.menge) || 1,
        einzelpreis: Number.isFinite(stundensatz) && Number(p.einzelpreis) === stundensatz ? null : (Number(p.einzelpreis) || 0),
      })),
    ].map((z, i) => ({ ...z, beschreibung: String(z.beschreibung ?? '').slice(0, 300) || 'Position', paket_id: paket.id, betrieb_id: betriebId, sortierung: i }))
    const ins = await supabase.from('leistungspaket_positionen').insert(zeilen)
    if (ins.error) {
      await supabase.from('leistungspakete').delete().eq('id', paket.id)
      throw ins.error
    }
    return NextResponse.json({ erfolg: true, paketId: paket.id, teile: teile?.length ?? 0, arbeiten: arbeiten?.length ?? 0 })
  } catch (e) {
    return serverFehler(e, 'leistungspaket/aus-auftrag')
  }
}
