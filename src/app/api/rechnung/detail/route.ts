import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { resolveRechnungDetail } from '@/lib/rechnung-detail'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { rechnungId, betriebId } = await req.json()
    if (!rechnungId || !betriebId) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const { data: betriebCheck } = await supabase
      .from('betrieb_users')
      .select('id')
      .eq('betrieb_id', betriebId)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!betriebCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const detail = await resolveRechnungDetail(supabase, rechnungId, betriebId)
    if (!detail) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })

    return NextResponse.json(detail)
  } catch (error: any) {
    console.error('[Rechnung Detail] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
