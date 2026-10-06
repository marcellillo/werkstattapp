import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCodeForTokens } from '@/lib/graph-client'
import { pruefeState, GRAPH_NONCE_COOKIE } from '@/lib/graph-state'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://werkstatt-app-umber.vercel.app'

function zurueck(pfad: string) {
  const res = NextResponse.redirect(new URL(pfad, APP_URL))
  res.cookies.delete({ name: GRAPH_NONCE_COOKIE, path: '/api/graph' })
  return res
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDesc = searchParams.get('error_description')

  if (error || !code) {
    return zurueck(`/einstellungen?error=${encodeURIComponent(errorDesc ?? error ?? 'kein_code')}`)
  }

  // Der Rückweg muss zu dem Browser gehören, der die Anmeldung gestartet hat
  const betriebId = pruefeState(searchParams.get('state'), req.cookies.get(GRAPH_NONCE_COOKIE)?.value)
  if (!betriebId) {
    return zurueck('/einstellungen?error=Die+Anmeldung+ist+abgelaufen+oder+ung%C3%BCltig.+Bitte+erneut+auf+%22Mit+Microsoft+verbinden%22+klicken')
  }

  // ... und der angemeldete Nutzer muss Admin dieses Betriebs sein
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return zurueck('/login')
  const { data: mitglied } = await sessionClient
    .from('betrieb_users').select('role').eq('betrieb_id', betriebId).eq('profile_id', user.id).maybeSingle()
  if (mitglied?.role !== 'admin' && mitglied?.role !== 'superadmin') {
    return zurueck('/einstellungen?error=Keine+Berechtigung')
  }

  // Service-Role: Tokens schreiben (Einstellungen sind nicht für alle Rollen beschreibbar)
  const supabase = createAdminClient()

  const { data: rows } = await supabase
    .from('betrieb_einstellungen')
    .select('schluessel, wert')
    .eq('betrieb_id', betriebId)
    .in('schluessel', ['graph_client_id', 'graph_tenant_id', 'graph_client_secret'])

  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  if (!cfg.graph_client_id || !cfg.graph_tenant_id || !cfg.graph_client_secret) {
    return zurueck('/einstellungen?error=Azure-Zugangsdaten+fehlen+in+den+Einstellungen')
  }

  try {
    const { accessToken, refreshToken } = await exchangeCodeForTokens(
      code, cfg.graph_client_id, cfg.graph_tenant_id, cfg.graph_client_secret,
    )

    // E-Mail-Adresse des verbundenen Kontos holen
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const me = await meRes.json()
    const email = me.mail ?? me.userPrincipalName ?? ''

    const { error: saveErr } = await supabase.from('betrieb_einstellungen').upsert([
      { betrieb_id: betriebId, schluessel: 'graph_refresh_token', wert: refreshToken },
      { betrieb_id: betriebId, schluessel: 'graph_email',         wert: email },
      { betrieb_id: betriebId, schluessel: 'graph_fehler',        wert: '' },
      { betrieb_id: betriebId, schluessel: 'email_sync_aktiv',    wert: 'true' },
    ], { onConflict: 'betrieb_id,schluessel' })
    if (saveErr) throw new Error(`Verbindung konnte nicht gespeichert werden: ${saveErr.message}`)

    return zurueck('/einstellungen?success=graph_verbunden')
  } catch (e: any) {
    return zurueck(`/einstellungen?error=${encodeURIComponent(e.message)}`)
  }
}
