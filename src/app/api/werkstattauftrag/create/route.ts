import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateWerkstattauftragNummer } from '@/lib/nummernvergabe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { auftragId, betriebId, fahrzeugId } = await req.json()

    console.log('[WA Create] Input:', { auftragId, betriebId, fahrzeugId })

    if (!fahrzeugId) return NextResponse.json({ error: 'fahrzeugId erforderlich' }, { status: 400 })
    if (!betriebId) return NextResponse.json({ error: 'betriebId erforderlich' }, { status: 400 })

    // Generiere Nummer basierend auf FIN
    const nummer = await generateWerkstattauftragNummer(supabase, fahrzeugId, betriebId)
    console.log('[WA Create] Generated nummer:', nummer)

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
