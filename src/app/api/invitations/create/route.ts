import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email, betriebId, rolle = 'mechaniker' } = await req.json()

    if (!email || !betriebId) {
      return NextResponse.json({ error: 'Email und Betrieb erforderlich' }, { status: 400 })
    }

    // Check ob User Admin ist
    const { data: userRole } = await supabase
      .from('betrieb_users')
      .select('role')
      .eq('betrieb_id', betriebId)
      .eq('profile_id', user.id)
      .single()

    if (userRole?.role !== 'admin' && userRole?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Nur Admins können einladen' }, { status: 403 })
    }

    // Generate Token
    const token = crypto.randomBytes(32).toString('hex')
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/register?token=${token}`

    // Create invitation
    const { data, error } = await supabase.from('user_invitations').insert({
      betrieb_id: betriebId,
      email,
      token,
      role: rolle,
      erstellt_von: user.id,
    }).select().single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      invitation: data,
      inviteLink,
    })
  } catch (error: any) {
    console.error('[Invitations] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
