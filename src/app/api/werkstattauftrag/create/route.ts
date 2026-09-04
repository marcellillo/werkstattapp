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

    if (!betriebId) return NextResponse.json({ error: 'betriebId erforderlich' }, { status: 400 })

    // Überprüfe, ob User dieser betriebId angehört
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

    const nummer = await generateWerkstattauftragNummer(supabase, fahrzeugId, betriebId)

    const { data: werkstattauftrag, error } = await supabase
      .from('werkstattauftraege')
      .insert({
        betrieb_id: betriebId,
        status: 'neu',
        nummer,
        fahrzeug_id: fahrzeugId || null,
        auftrag_id: auftragId || null,
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
