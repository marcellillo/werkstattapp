import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: userBetrieb } = await supabase
    .from('betrieb_users')
    .select('betrieb_id')
    .eq('profile_id', user.id)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle()
  const betriebId = userBetrieb?.betrieb_id
  if (!betriebId) return NextResponse.json({ error: 'Kein Betrieb zugeordnet' }, { status: 403 })

  const { data: rechnungen } = await supabase
    .from('rechnungen')
    .select('*, positionen:rechnung_positionen(*)')
    .eq('betrieb_id', betriebId)
    .order('erstellt_am', { ascending: false })

  return NextResponse.json({ rechnungen: rechnungen ?? [] })
}
