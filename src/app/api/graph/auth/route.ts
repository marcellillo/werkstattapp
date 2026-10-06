import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOAuthUrl } from '@/lib/graph-client'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { erzeugeState, GRAPH_NONCE_COOKIE } from '@/lib/graph-state'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://werkstatt-app-umber.vercel.app'

// Startet die Microsoft-Anmeldung für das E-Mail-Postfach (nur Admins).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', APP_URL))

  let betriebId: string
  try {
    betriebId = await getBetriebIdForUser(supabase, user.id)
  } catch {
    return NextResponse.json({ error: 'Kein Betrieb zugeordnet' }, { status: 403 })
  }

  const { data: mitglied } = await supabase
    .from('betrieb_users').select('role').eq('betrieb_id', betriebId).eq('profile_id', user.id).maybeSingle()
  if (mitglied?.role !== 'admin' && mitglied?.role !== 'superadmin') {
    return NextResponse.redirect(new URL('/einstellungen?error=Nur+Administratoren+k%C3%B6nnen+das+Postfach+verbinden', APP_URL))
  }

  const { data: rows } = await supabase
    .from('betrieb_einstellungen')
    .select('schluessel, wert')
    .eq('betrieb_id', betriebId)
    .in('schluessel', ['graph_client_id', 'graph_tenant_id'])

  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  if (!cfg.graph_client_id || !cfg.graph_tenant_id) {
    return NextResponse.redirect(new URL('/einstellungen?error=Azure-Zugangsdaten+fehlen.+Bitte+zuerst+Anwendungs-ID+und+Verzeichnis-ID+eintragen', APP_URL))
  }

  const { state, nonce } = erzeugeState(betriebId)
  const res = NextResponse.redirect(getOAuthUrl(cfg.graph_client_id, cfg.graph_tenant_id, state))
  res.cookies.set(GRAPH_NONCE_COOKIE, nonce, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/api/graph', maxAge: 600,
  })
  return res
}
