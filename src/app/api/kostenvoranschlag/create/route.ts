import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { auftragId, betriebId, typ } = await req.json()

    const { data: kostenvoranschlag, error } = await supabase
      .from('kostenvoranschlaege')
      .insert({
        betrieb_id: betriebId,
        typ,
        status: 'entwurf',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ kostenvoranschlag })
  } catch (error: any) {
    console.error('[Kostenvoranschlag Create] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
