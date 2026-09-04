import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { kostenvoranschlagId, betriebId } = await req.json()

    if (!kostenvoranschlagId || !betriebId) {
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

    // Überprüfe, ob der Kostenvoranschlag zu diesem Betrieb gehört
    const { data: kvCheck } = await supabase
      .from('kostenvoranschlaege')
      .select('id')
      .eq('id', kostenvoranschlagId)
      .eq('betrieb_id', betriebId)
      .maybeSingle()

    if (!kvCheck) {
      return NextResponse.json({ error: 'Kostenvoranschlag nicht gefunden' }, { status: 404 })
    }

    // Delete positions first
    await supabase
      .from('kostenvoranschlag_position')
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
