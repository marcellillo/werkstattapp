import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateRechnungsNummer } from '@/lib/nummernvergabe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { auftragId, betriebId, fahrzeugId, typ } = await req.json()

    // Generiere Nummer
    const nummer = await generateRechnungsNummer(supabase, typ, betriebId)

    const { data: rechnung, error } = await supabase
      .from('rechnungen')
      .insert({
        betrieb_id: betriebId,
        werkstattauftrag_id: typ === 'werkstatt' ? auftragId : null,
        fahrzeug_id: typ === 'verkauf' ? fahrzeugId : null,
        typ,
        nummer,
        status: 'entwurf',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ rechnung })
  } catch (error: any) {
    console.error('[Rechnung Create] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
