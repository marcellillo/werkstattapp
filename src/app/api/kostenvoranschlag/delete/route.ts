import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { kostenvoranschlagId, betriebId } = await req.json()

    // Delete positions first
    await supabase
      .from('kostenvoranschlag_positionen')
      .delete()
      .eq('kostenvoranschlag_id', kostenvoranschlagId)

    // Delete Kostenvoranschlag
    const { error } = await supabase
      .from('kostenvoranschlaege')
      .delete()
      .eq('id', kostenvoranschlagId)
      .eq('betrieb_id', betriebId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Delete KV] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
