import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { werkstattauftragId, betriebId } = await req.json()

    if (!werkstattauftragId || !betriebId) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

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

    // Überprüfe, ob der Werkstattauftrag zu diesem Betrieb gehört
    const { data: waCheck } = await supabase
      .from('werkstattauftraege')
      .select('id')
      .eq('id', werkstattauftragId)
      .eq('betrieb_id', betriebId)
      .maybeSingle()

    if (!waCheck) {
      return NextResponse.json({ error: 'Werkstattauftrag nicht gefunden' }, { status: 404 })
    }

    // Delete positions first
    await supabase
      .from('werkstattauftrag_positionen')
      .delete()
      .eq('werkstattauftrag_id', werkstattauftragId)

    // Delete Werkstattauftrag
    const { error } = await supabase
      .from('werkstattauftraege')
      .delete()
      .eq('id', werkstattauftragId)
      .eq('betrieb_id', betriebId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Delete WA] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
