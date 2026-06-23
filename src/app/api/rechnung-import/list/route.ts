import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: rechnungen } = await supabase
    .from('rechnungen')
    .select('*, positionen:rechnung_positionen(*)')
    .order('erstellt_am', { ascending: false })

  return NextResponse.json({ rechnungen: rechnungen ?? [] })
}
