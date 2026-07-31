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

    // Generiere Nummer
    let nummer: string
    if (fahrzeugId) {
      nummer = await generateWerkstattauftragNummer(supabase, fahrzeugId, betriebId)
    } else {
      // Fallback: einfache Nummer ohne FIN
      const year = new Date().getFullYear().toString().slice(-2)
      const { count } = await supabase
        .from('werkstattauftraege')
        .select('*', { count: 'exact', head: true })
        .eq('betrieb_id', betriebId)

      const nextNum = (count || 0) + 1
      nummer = `WA-${year}${String(nextNum).padStart(4, '0')}`
    }
    console.log('[WA Create] Generated nummer:', nummer)

    const { data: werkstattauftrag, error } = await supabase
      .from('werkstattauftraege')
      .insert({
        betrieb_id: betriebId,
        nummer,
        status: 'neu',
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
