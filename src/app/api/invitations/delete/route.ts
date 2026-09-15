import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { invitationId, betriebId } = await req.json()

    if (!invitationId || !betriebId) {
      return NextResponse.json({ error: 'Einladung und Betrieb erforderlich' }, { status: 400 })
    }

    // Check ob User Admin ist
    const { data: userRole } = await supabase
      .from('betrieb_users')
      .select('role')
      .eq('betrieb_id', betriebId)
      .eq('profile_id', user.id)
      .single()

    if (userRole?.role !== 'admin' && userRole?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Nur Admins können Einladungen löschen' }, { status: 403 })
    }

    const { error } = await supabase
      .from('user_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('betrieb_id', betriebId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Invitations Delete] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
