import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBetriebIdForUser } from '@/lib/server-betrieb'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ anzahl: 0 })

  try {
    const betriebId = await getBetriebIdForUser(supabase, user.id)

    const { count } = await supabase
      .from('benachrichtigungen')
      .select('*', { count: 'exact', head: true })
      .eq('betrieb_id', betriebId)
      .or(`benutzer_id.eq.${user.id},benutzer_id.is.null`)
      .eq('gelesen', false)

    return NextResponse.json({ anzahl: count ?? 0 })
  } catch (error) {
    console.error('Error in benachrichtigungen/anzahl:', error)
    return NextResponse.json({ anzahl: 0 })
  }
}
