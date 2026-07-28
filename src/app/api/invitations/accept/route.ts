import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { token } = await req.json()
    if (!token) {
      return NextResponse.json({ error: 'Token erforderlich' }, { status: 400 })
    }

    // Get invitation
    const { data: invitation, error: invError } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (invError || !invitation) {
      return NextResponse.json({ error: 'Einladung ungültig' }, { status: 404 })
    }

    // Check if expired
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Einladung wurde bereits verwendet oder ist abgelaufen' }, { status: 400 })
    }

    if (new Date(invitation.abgelaufen_am) < new Date()) {
      await supabase
        .from('user_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)
      return NextResponse.json({ error: 'Einladung ist abgelaufen' }, { status: 400 })
    }

    // Accept invitation - add user to betrieb
    // First check if user already exists in this betrieb
    const { data: existingUser } = await supabase
      .from('betrieb_users')
      .select('id')
      .eq('betrieb_id', invitation.betrieb_id)
      .eq('profile_id', user.id)
      .single()

    let addError = null
    if (existingUser) {
      // User exists, update role
      const { error } = await supabase
        .from('betrieb_users')
        .update({ role: invitation.rolle })
        .eq('betrieb_id', invitation.betrieb_id)
        .eq('profile_id', user.id)
      addError = error
    } else {
      // User doesn't exist, insert
      const { error } = await supabase.from('betrieb_users').insert({
        betrieb_id: invitation.betrieb_id,
        profile_id: user.id,
        role: invitation.rolle,
        is_primary: false,
      })
      addError = error
    }

    if (addError) throw addError

    // Mark invitation as accepted
    await supabase
      .from('user_invitations')
      .update({
        status: 'accepted',
        akzeptiert_am: new Date().toISOString(),
      })
      .eq('id', invitation.id)

    return NextResponse.json({
      success: true,
      betriebId: invitation.betrieb_id,
      rolle: invitation.rolle,
    })
  } catch (error: any) {
    console.error('[Accept Invitation] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
