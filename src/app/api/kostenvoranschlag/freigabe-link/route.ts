export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { pruefeZugriff } from '@/lib/auftrag-dokumente-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { serverFehler } from '@/lib/api-fehler'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/kostenvoranschlag/freigabe-link  { kostenvoranschlagId }
// Liefert den Link, mit dem der Kunde den Kostenvoranschlag ohne Anmeldung freigeben kann. Das Token bleibt pro
// Kostenvoranschlag gleich (ein schon verschickter Link funktioniert weiter) und wird nur serverseitig gespeichert.
export async function POST(req: NextRequest) {
  const { kostenvoranschlagId } = await req.json().catch(() => ({}))
  if (!UUID.test(kostenvoranschlagId ?? '')) return NextResponse.json({ error: 'kostenvoranschlagId fehlt' }, { status: 400 })

  const zugriff = await pruefeZugriff()
  if ('res' in zugriff) return zugriff.res
  const { supabase, betriebId, userId } = zugriff
  const limit = await rateLimit(`freigabe-link:${userId}`, 60, 600)
  if (limit) return limit

  try {
    // RLS: nur Kostenvoranschläge des eigenen Betriebs sichtbar
    const { data: kva } = await supabase.from('kostenvoranschlaege').select('id, status, rechnung_id, auftrag_id')
      .eq('id', kostenvoranschlagId).eq('betrieb_id', betriebId).maybeSingle()
    if (!kva) return NextResponse.json({ error: 'Kostenvoranschlag nicht gefunden' }, { status: 404 })
    if (kva.rechnung_id) return NextResponse.json({ error: 'Dieser Kostenvoranschlag ist bereits abgerechnet.' }, { status: 409 })

    const admin = createAdminClient()
    let { data: eintrag } = await admin.from('kva_freigabe_tokens').select('token').eq('kva_id', kva.id).maybeSingle()
    if (!eintrag) {
      const neu = await admin.from('kva_freigabe_tokens').insert({ kva_id: kva.id, betrieb_id: betriebId, token: randomBytes(32).toString('hex') }).select('token').single()
      if (neu.error) throw neu.error
      eintrag = neu.data
    }
    const update: Record<string, any> = { freigabe_gesendet_am: new Date().toISOString() }
    // Entwurf oder zuvor abgelehnt (z. B. nach Änderungen) -> wieder "gesendet", alte Rückfrage des Kunden löschen
    if (kva.status === 'entwurf' || kva.status === 'abgelehnt') { update.status = 'gesendet'; update.freigabe_hinweis = null }
    await admin.from('kostenvoranschlaege').update(update).eq('id', kva.id)

    const basis = req.nextUrl.origin
    return NextResponse.json({ url: `${basis}/freigabe/${eintrag!.token}`, status: update.status ?? kva.status })
  } catch (e) {
    return serverFehler(e, 'kostenvoranschlag/freigabe-link')
  }
}
