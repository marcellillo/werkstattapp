import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOAuthUrl } from '@/lib/graph-client'

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

  const { data: rows } = await supabase
    .from('betrieb_einstellungen')
    .select('schluessel, wert')
    .eq('betrieb_id', betriebId)
    .in('schluessel', ['graph_client_id', 'graph_tenant_id'])

  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) cfg[r.schluessel] = r.wert

  if (!cfg.graph_client_id || !cfg.graph_tenant_id) {
    return NextResponse.redirect(
      new URL('/einstellungen?error=graph_nicht_konfiguriert', process.env.NEXT_PUBLIC_APP_URL ?? 'https://werkstatt-app-umber.vercel.app')
    )
  }

  // betriebId als OAuth state durchreichen, damit der Callback (der ohne
  // Session-Cookie laeuft) weiss, welchem Betrieb die Tokens gehoeren.
  const url = getOAuthUrl(cfg.graph_client_id, cfg.graph_tenant_id, betriebId)
  return NextResponse.redirect(url)
}
