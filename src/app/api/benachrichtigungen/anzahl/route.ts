import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ anzahl: 0 })

  const { count } = await supabase
    .from('benachrichtigungen')
    .select('*', { count: 'exact', head: true })
    .or(`benutzer_id.eq.${user.id},benutzer_id.is.null`)
    .eq('gelesen', false)

  return NextResponse.json({ anzahl: count ?? 0 })
}
