import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateWerkstattauftragNummer } from '@/lib/nummernvergabe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { auftragId, betriebId, fahrzeugId } = await req.json()

    // Generiere Nummer basierend auf FIN
    const nummer = await generateWerkstattauftragNummer(supabase, fahrzeugId, betriebId)

    const { data: werkstattauftrag, error } = await supabase
      .from('werkstattauftraege')
      .insert({
        betrieb_id: betriebId,
        nummer,
        status: 'neu',
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ werkstattauftrag })
  } catch (error: any) {
    console.error('[Werkstattauftrag Create] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
