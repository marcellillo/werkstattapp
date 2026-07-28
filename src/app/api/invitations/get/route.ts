import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Token erforderlich' }, { status: 400 })
    }

    // Get invitation
    const { data: invitation, error } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !invitation) {
      return NextResponse.json({ error: 'Einladung ungültig' }, { status: 404 })
    }

    // Check if expired
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Einladung wurde bereits verwendet oder ist abgelaufen' }, { status: 400 })
    }

    if (new Date(invitation.abgelaufen_am) < new Date()) {
      return NextResponse.json({ error: 'Einladung ist abgelaufen' }, { status: 400 })
    }

    return NextResponse.json({
      invitation: {
        email: invitation.email,
        rolle: invitation.rolle,
      },
    })
  } catch (error: any) {
    console.error('[Get Invitation] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
