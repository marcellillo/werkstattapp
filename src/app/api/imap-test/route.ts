import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testImapConnection } from '@/lib/imap-client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: configRows } = await supabase
    .from('werkstatt_einstellungen')
    .select('schluessel, wert')

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
