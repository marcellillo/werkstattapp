import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { rechnungId, betriebId, neueNummer } = await req.json()
    if (!rechnungId || !betriebId || !neueNummer?.trim()) {
      return NextResponse.json({ error: 'Rechnung, Betrieb und neue Nummer erforderlich' }, { status: 400 })
    }
    const nummer = neueNummer.trim()

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

    // Es gibt keine DB-Unique-Constraint auf rechnungs_nr -- Eindeutigkeit innerhalb
    // des Betriebs hier in der App sicherstellen, damit keine zwei Rechnungen
    // versehentlich dieselbe Nummer tragen.
    const { data: duplicate } = await supabase
      .from('kunden_rechnungen')
      .select('id')
      .eq('betrieb_id', betriebId)
      .eq('rechnungs_nr', nummer)
      .neq('id', rechnungId)
      .maybeSingle()

    if (duplicate) {
      return NextResponse.json({ error: `Rechnungsnummer "${nummer}" wird bereits verwendet` }, { status: 409 })
    }

    const { error: updateError, count } = await supabase
      .from('kunden_rechnungen')
      .update({ rechnungs_nr: nummer }, { count: 'exact' })
      .eq('id', rechnungId)
      .eq('betrieb_id', betriebId)

    if (updateError) throw updateError
    if (!count) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })

    return NextResponse.json({ erfolg: true, rechnungs_nr: nummer })
  } catch (error: any) {
    console.error('[Rechnung Nummer Update] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
