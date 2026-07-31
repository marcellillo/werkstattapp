import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { werkstattauftragId, betriebId } = await req.json()

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
