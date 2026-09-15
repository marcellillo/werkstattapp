import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { membershipId, betriebId } = await req.json()

    if (!membershipId || !betriebId) {
      return NextResponse.json({ error: 'Mitgliedschaft und Betrieb erforderlich' }, { status: 400 })
    }

    // Check ob User Admin ist
    const { data: userRole } = await supabase
      .from('betrieb_users')
      .select('role')
      .eq('betrieb_id', betriebId)
      .eq('profile_id', user.id)
      .single()

    if (userRole?.role !== 'admin' && userRole?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Nur Admins können Mitarbeiter entfernen' }, { status: 403 })
    }

    // Nicht sich selbst entfernen (würde ggf. den letzten Admin aussperren)
    const { data: target } = await supabase
      .from('betrieb_users')
      .select('profile_id')
      .eq('id', membershipId)
      .eq('betrieb_id', betriebId)
      .single()

    if (target?.profile_id === user.id) {
      return NextResponse.json({ error: 'Du kannst dich nicht selbst entfernen' }, { status: 400 })
    }

    const { error } = await supabase
      .from('betrieb_users')
      .delete()
      .eq('id', membershipId)
      .eq('betrieb_id', betriebId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Team Remove] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
