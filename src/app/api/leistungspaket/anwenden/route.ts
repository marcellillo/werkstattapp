export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { pruefeZugriff } from '@/lib/auftrag-dokumente-server'
import { generateKostenvoranschlagNummer, generateWerkstattauftragNummer } from '@/lib/nummernvergabe'
import { rateLimit } from '@/lib/rate-limit'
import { serverFehler } from '@/lib/api-fehler'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const auf2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// POST /api/leistungspaket/anwenden  { auftragId, paketId }
// Übernimmt ein Leistungspaket in den Auftrag: Teile -> offener Kostenvoranschlag (wird bei Bedarf angelegt),
// Arbeitszeit -> offener Werkstattauftrag (Stundensatz aus den Einstellungen, falls im Paket nicht fest vorgegeben).
export async function POST(req: NextRequest) {
  const { auftragId, paketId } = await req.json().catch(() => ({}))
  if (!UUID.test(auftragId ?? '') || !UUID.test(paketId ?? '')) return NextResponse.json({ error: 'auftragId und paketId erforderlich' }, { status: 400 })

  const zugriff = await pruefeZugriff(auftragId)
  if ('res' in zugriff) return zugriff.res
  const { supabase, betriebId, userId } = zugriff
  const limit = await rateLimit(`leistungspaket:${userId}`, 60, 600)
  if (limit) return limit

  try {
    const { data: auftrag } = await supabase.from('auftraege').select('id, fahrzeug_id, status').eq('id', auftragId).eq('betrieb_id', betriebId).maybeSingle()
    if (!auftrag) return NextResponse.json({ error: 'Auftrag nicht gefunden' }, { status: 404 })
    if (['ausgeliefert', 'storniert', 'verkauft'].includes(auftrag.status)) {
      return NextResponse.json({ error: 'Dieser Auftrag ist abgeschlossen — es können keine Positionen mehr hinzugefügt werden.' }, { status: 409 })
    }

    const { data: paket } = await supabase.from('leistungspakete').select('id, name').eq('id', paketId).eq('betrieb_id', betriebId).maybeSingle()
    if (!paket) return NextResponse.json({ error: 'Paket nicht gefunden' }, { status: 404 })
    const { data: positionen } = await supabase.from('leistungspaket_positionen').select('*').eq('paket_id', paketId).eq('betrieb_id', betriebId).order('sortierung')
    const teile = (positionen ?? []).filter(p => p.art === 'teil')
    const arbeiten = (positionen ?? []).filter(p => p.art === 'arbeit')
    // Betriebsstoffe (Öl, Kühlmittel …) des Pakets: nur aktive Stoffe dieses Betriebs
    const { data: paketStoffe } = await supabase.from('leistungspaket_betriebsstoffe')
      .select('betriebsstoff_id, menge, stoff:betriebsstoffe(name, einheit, aktiv, preis_pro_einheit)')
      .eq('paket_id', paketId).eq('betrieb_id', betriebId)
    const stoffe = (paketStoffe ?? []) as any[]
    if (!teile.length && !arbeiten.length && !stoffe.length) return NextResponse.json({ error: 'Das Paket enthält keine Positionen.' }, { status: 400 })

    const hinweise: string[] = []
    let kostenvoranschlagId: string | null = null
    let werkstattauftragId: string | null = null

    // ── Teile -> Kostenvoranschlag ──
    if (teile.length) {
      let { data: kv } = await supabase.from('kostenvoranschlaege')
        .select('id, ersatzteile_modus, ersatzteile_festpreis')
        .eq('betrieb_id', betriebId).eq('auftrag_id', auftragId).is('rechnung_id', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!kv) {
        const nummer = await generateKostenvoranschlagNummer(supabase, auftrag.fahrzeug_id, betriebId)
        const neu = await supabase.from('kostenvoranschlaege')
          .insert({ betrieb_id: betriebId, typ: 'werkstatt', nummer, fahrzeug_id: auftrag.fahrzeug_id ?? null, auftrag_id: auftragId })
          .select('id, ersatzteile_modus, ersatzteile_festpreis').maybeSingle()
        if (neu.error) throw neu.error
        kv = neu.data
      }
      if (!kv) throw new Error('Kostenvoranschlag konnte nicht angelegt werden')
      // Einzelpositionen zählen nur im Modus "einzeln" — bei gesetztem Festpreis würden sie in der Rechnung fehlen
      if (kv.ersatzteile_modus === 'festpreis' && Number(kv.ersatzteile_festpreis) > 0) {
        return NextResponse.json({ error: 'Der Kostenvoranschlag steht auf „Festpreis“. Bitte dort auf „Einzeln“ umstellen oder den Festpreis entfernen, dann das Paket erneut hinzufügen.' }, { status: 409 })
      }
      if (kv.ersatzteile_modus !== 'einzeln') {
        const { error } = await supabase.from('kostenvoranschlaege').update({ ersatzteile_modus: 'einzeln' }).eq('id', kv.id)
        if (error) throw error
      }
      const { error } = await supabase.from('kostenvoranschlag_position').insert(teile.map(p => ({
        kostenvoranschlag_id: kv!.id, betrieb_id: betriebId, beschreibung: p.beschreibung,
        menge: Number(p.menge), einzelpreis: Number(p.einzelpreis ?? 0), gesamtpreis: auf2(Number(p.menge) * Number(p.einzelpreis ?? 0)),
        einkaufspreis: null,
      })))
      if (error) throw error
      kostenvoranschlagId = kv.id
      if (teile.some(p => !Number(p.einzelpreis))) hinweise.push('Bei einzelnen Teilen ist noch kein Preis hinterlegt — bitte im Kostenvoranschlag ergänzen.')
    }

    // ── Arbeit -> Werkstattauftrag ──
    if (arbeiten.length) {
      const { data: cfg } = await supabase.from('betrieb_einstellungen').select('wert').eq('betrieb_id', betriebId).eq('schluessel', 'firma_stundensatz').maybeSingle()
      const stundensatz = parseFloat(String(cfg?.wert ?? '').replace(',', '.'))
      let { data: wa } = await supabase.from('werkstattauftraege').select('id')
        .eq('betrieb_id', betriebId).eq('auftrag_id', auftragId).is('rechnung_id', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!wa) {
        const nummer = await generateWerkstattauftragNummer(supabase, auftrag.fahrzeug_id, betriebId)
        const neu = await supabase.from('werkstattauftraege')
          .insert({ betrieb_id: betriebId, status: 'neu', nummer, fahrzeug_id: auftrag.fahrzeug_id ?? null, auftrag_id: auftragId })
          .select('id').maybeSingle()
        if (neu.error) throw neu.error
        wa = neu.data
      }
      if (!wa) throw new Error('Werkstattauftrag konnte nicht angelegt werden')
      const { error } = await supabase.from('werkstattauftrag_positionen').insert(arbeiten.map(p => {
        const satz = p.einzelpreis != null ? Number(p.einzelpreis) : (Number.isFinite(stundensatz) ? stundensatz : 0)
        return {
          werkstattauftrag_id: wa!.id, betrieb_id: betriebId, beschreibung: p.beschreibung,
          menge: Number(p.menge), einzelpreis: satz, gesamtpreis: auf2(Number(p.menge) * satz),
        }
      }))
      if (error) throw error
      werkstattauftragId = wa.id
      if (arbeiten.some(p => p.einzelpreis == null) && !Number.isFinite(stundensatz)) {
        hinweise.push('Es ist noch kein Stundensatz hinterlegt (Einstellungen) — die Arbeitszeit steht auf 0 €.')
      }
    }

    // ── Betriebsstoffe -> Vorschlag am Auftrag (der Rechnungs-Assistent belegt die Mengen damit vor) ──
    let betriebsstoffeAnzahl = 0
    const aktive = stoffe.filter(s => s.stoff?.aktiv)
    if (aktive.length) {
      const { data: vorhanden } = await supabase.from('auftrag_betriebsstoffe').select('betriebsstoff_id, menge')
        .eq('auftrag_id', auftragId).eq('betrieb_id', betriebId)
      const bisher = new Map<string, number>((vorhanden ?? []).map((v: any) => [v.betriebsstoff_id, Number(v.menge)]))
      const { error } = await supabase.from('auftrag_betriebsstoffe').upsert(aktive.map(s => ({
        auftrag_id: auftragId, betrieb_id: betriebId, betriebsstoff_id: s.betriebsstoff_id,
        menge: Math.round((Number(s.menge) + (bisher.get(s.betriebsstoff_id) ?? 0)) * 100) / 100,
        quelle: paket.name.slice(0, 120),
      })), { onConflict: 'auftrag_id,betriebsstoff_id' })
      if (error) throw error
      betriebsstoffeAnzahl = aktive.length
      if (aktive.some(s => !(Number(s.stoff?.preis_pro_einheit) > 0))) hinweise.push('Bei einem Betriebsstoff fehlt noch der Preis — bitte unter „Betriebsstoffe“ im Menü eintragen, sonst kann er nicht berechnet werden.')
    }
    if (stoffe.length > aktive.length) hinweise.push('Ein Betriebsstoff des Pakets ist deaktiviert und wurde nicht übernommen.')

    return NextResponse.json({ erfolg: true, paket: paket.name, teile: teile.length, arbeiten: arbeiten.length, betriebsstoffe: betriebsstoffeAnzahl, kostenvoranschlagId, werkstattauftragId, hinweise })
  } catch (e) {
    return serverFehler(e, 'leistungspaket/anwenden')
  }
}
