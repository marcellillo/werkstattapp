import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testImapConnection } from '@/lib/imap-client'

export async function POST() {
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

  const { data: configRows } = await supabase
    .from('betrieb_einstellungen')
    .select('schluessel, wert')
    .eq('betrieb_id', betriebId)

  const cfg: Record<string, string> = {}
  for (const row of configRows ?? []) {
    if (row.wert) cfg[row.schluessel] = row.wert
  }

  const { imap_email, imap_password } = cfg
  if (!imap_email || !imap_password) {
    return NextResponse.json({ ok: false, error: 'E-Mail oder Passwort fehlt' }, { status: 400 })
  }

  const result = await testImapConnection({ email: imap_email, password: imap_password })
  return NextResponse.json(result)
}
