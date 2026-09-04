import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

    const { data: rechnung, error: rechnungError } = await supabase
      .from('kunden_rechnungen')
      .select('id')
      .eq('id', rechnungId)
      .eq('betrieb_id', betriebId)
      .maybeSingle()

    if (rechnungError) throw rechnungError
    if (!rechnung) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })

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

    return NextResponse.json({ erfolg: true })
  } catch (error: any) {
    console.error('[Rechnung Delete] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
