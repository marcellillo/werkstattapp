import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/email-service'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { betriebId, email, role } = await req.json()

    if (!betriebId || !email || !role) {
      return NextResponse.json(
        { error: 'betriebId, email und role erforderlich' },
        { status: 400 }
      )
    }

    // Verify user is admin of this betrieb
    const { data: adminCheck } = await supabase
      .from('betrieb_users')
      .select('role')
      .eq('betrieb_id', betriebId)
      .eq('profile_id', user.id)
      .single()

    if (!adminCheck || adminCheck.role !== 'admin') {
      return NextResponse.json(
        { error: 'Nur Admins dürfen Mitarbeiter einladen' },
        { status: 403 }
      )
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .single()

    if (existingProfile) {
      // User exists - add to betrieb if not already
      const { data: alreadyAdded } = await supabase
        .from('betrieb_users')
        .select('id')
        .eq('betrieb_id', betriebId)
        .eq('profile_id', existingProfile.id)
        .single()

      if (alreadyAdded) {
        return NextResponse.json(
          { error: 'Benutzer ist bereits Mitglied dieses Betriebs' },
          { status: 400 }
        )
      }

      // Add existing user to betrieb
      const { error: insertError } = await supabase.from('betrieb_users').insert({
        betrieb_id: betriebId,
        profile_id: existingProfile.id,
        role,
        is_primary: false,
      })

      if (insertError) throw insertError

      return NextResponse.json({
        message: `${email} wurde als ${role} hinzugefügt`,
        userId: existingProfile.id,
      })
    }

    // Get betrieb info for email
    const { data: betrieb } = await supabase
      .from('betriebe')
      .select('name')
      .eq('id', betriebId)
      .single()

    if (!betrieb) {
      return NextResponse.json({ error: 'Betrieb nicht gefunden' }, { status: 404 })
    }

    // Create invite token (valid for 7 days)
    const inviteToken = Buffer.from(
      JSON.stringify({
        email,
        betriebId,
        role,
        createdAt: Date.now(),
      })
    ).toString('base64')

    // Send invite email
    await sendInviteEmail({
      email,
      betriebName: betrieb.name,
      role,
      inviteToken,
    })

    // Log invite attempt (for audit)
    await supabase.from('betrieb_payment_events').insert({
      betrieb_id: betriebId,
      stripe_event_type: 'user.invite.created',
      event_data: {
        email,
        role,
        invitedBy: user.id,
      },
    })

    return NextResponse.json({
      message: `Einladung an ${email} versendet`,
      email,
    })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Einladung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
