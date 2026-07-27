import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { betriebId, config } = await req.json()

    if (!betriebId || !config) {
      return NextResponse.json({ error: 'betriebId and config required' }, { status: 400 })
    }

    // TODO: Verify user is admin of betrieb
    // For now, allow any authenticated user to update settings
    // const { data: userRole } = await supabase
    //   .from('betrieb_users')
    //   .select('rolle')
    //   .eq('betrieb_id', betriebId)
    //   .eq('profile_id', user.id)
    //   .single()
    //
    // if (userRole?.rolle !== 'admin') {
    //   return NextResponse.json({ error: 'Only admins can update settings' }, { status: 403 })
    // }

    // Upsert settings
    const { error } = await supabase
      .from('betriebs_einstellungen')
      .upsert({
        betrieb_id: betriebId,
        ...config,
        aktualisiert_am: new Date().toISOString(),
      }, {
        onConflict: 'betrieb_id'
      })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Settings Save] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
