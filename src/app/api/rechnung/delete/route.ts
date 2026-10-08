import { createClient } from '@/lib/supabase/server'
import { verlangeFinanzrolle } from '@/lib/rollen-server'
import { NextRequest, NextResponse } from 'next/server'
import { syncAuftragEinnahmen } from '@/lib/auftrag-einnahmen'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { rechnungId, betriebId } = await req.json()
    if (!rechnungId || !betriebId) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const { data: betriebCheck, error: checkError } = await supabase
      .from('betrieb_users')
      .select('id')
      .eq('betrieb_id', betriebId)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (checkError) throw checkError
    if (!betriebCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const rolleFehler = await verlangeFinanzrolle(supabase, user.id, betriebId)
    if (rolleFehler) return rolleFehler

    const { data: rechnung, error: rechnungError } = await supabase
      .from('kunden_rechnungen')
      .select('id, auftrag_id, status')
      .eq('id', rechnungId)
      .eq('betrieb_id', betriebId)
      .maybeSingle()

    if (rechnungError) throw rechnungError
    if (!rechnung) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })

    // Aufbewahrung: bezahlte Rechnungen und Rechnungen verkaufter/übergebener Fahrzeuge nur stornieren (vor dem Entknüpfen prüfen)
    const AUFBEWAHRUNG = 'Bezahlte Rechnungen und Rechnungen verkaufter bzw. übergebener Fahrzeuge werden aufbewahrt und können nicht gelöscht werden – bitte stattdessen stornieren.'
    if (rechnung.status === 'bezahlt') return NextResponse.json({ error: AUFBEWAHRUNG }, { status: 409 })
    if (rechnung.auftrag_id) {
      const { data: auftrag } = await supabase.from('auftraege').select('status').eq('id', rechnung.auftrag_id).maybeSingle()
      if (auftrag && ['verkauft', 'ausgeliefert'].includes(auftrag.status)) return NextResponse.json({ error: AUFBEWAHRUNG }, { status: 409 })
    }

    // Verknüpfte Kostenvoranschläge/Werkstattaufträge wieder als "offen" markieren,
    // damit sie in einer künftigen Rechnung erneut ausgewählt werden können.
    const { error: kvError } = await supabase
      .from('kostenvoranschlaege')
      .update({ rechnung_id: null })
      .eq('rechnung_id', rechnungId)
      .eq('betrieb_id', betriebId)
    if (kvError) throw kvError

    const { error: waError } = await supabase
      .from('werkstattauftraege')
      .update({ rechnung_id: null })
      .eq('rechnung_id', rechnungId)
      .eq('betrieb_id', betriebId)
    if (waError) throw waError

    const { error: deleteError } = await supabase
      .from('kunden_rechnungen')
      .delete()
      .eq('id', rechnungId)
      .eq('betrieb_id', betriebId)
    if (deleteError) throw deleteError

    await syncAuftragEinnahmen(supabase, rechnung.auftrag_id, betriebId)

    return NextResponse.json({ erfolg: true })
  } catch (error: any) {
    console.error('[Rechnung Delete] Error:', error)
    if (/AUFBEWAHRUNG/.test(error?.message ?? '')) return NextResponse.json({ error: String(error.message).replace(/^AUFBEWAHRUNG:\s*/, '') }, { status: 409 })
    return NextResponse.json({ error: 'Rechnung konnte nicht gelöscht werden' }, { status: 500 })
  }
}
