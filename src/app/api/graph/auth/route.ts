import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOAuthUrl } from '@/lib/graph-client'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: rows } = await supabase
    .from('werkstatt_einstellungen')
    .select('schluessel, wert')
    .in('schluessel', ['graph_client_id', 'graph_tenant_id'])

  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) cfg[r.schluessel] = r.wert

  if (!cfg.graph_client_id || !cfg.graph_tenant_id) {
    return NextResponse.redirect(
      new URL('/einstellungen?error=graph_nicht_konfiguriert', process.env.NEXT_PUBLIC_APP_URL ?? 'https://werkstatt-app-umber.vercel.app')
    )
  }

  const url = getOAuthUrl(cfg.graph_client_id, cfg.graph_tenant_id)
  return NextResponse.redirect(url)
}
