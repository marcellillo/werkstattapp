import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForTokens } from '@/lib/graph-client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://werkstatt-app-umber.vercel.app'

// Service-Role-Client umgeht RLS — kein Session-Cookie nötig
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDesc = searchParams.get('error_description')

  if (error || !code) {
    const msg = errorDesc ?? error ?? 'kein_code'
    return NextResponse.redirect(new URL(`/einstellungen?error=${encodeURIComponent(msg)}`, APP_URL))
  }

  const supabase = adminClient()

  // Client-Credentials aus DB lesen
  const { data: rows } = await supabase
    .from('werkstatt_einstellungen')
    .select('schluessel, wert')
    .in('schluessel', ['graph_client_id', 'graph_tenant_id', 'graph_client_secret'])

  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  if (!cfg.graph_client_id || !cfg.graph_tenant_id || !cfg.graph_client_secret) {
    return NextResponse.redirect(
      new URL('/einstellungen?error=Azure-Zugangsdaten+fehlen+in+den+Einstellungen', APP_URL)
    )
  }

  try {
    const { accessToken, refreshToken } = await exchangeCodeForTokens(
      code,
      cfg.graph_client_id,
      cfg.graph_tenant_id,
      cfg.graph_client_secret,
    )

    // E-Mail-Adresse des verbundenen Kontos holen
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const me = await meRes.json()
    const email = me.mail ?? me.userPrincipalName ?? ''

    // Tokens speichern — service role umgeht RLS
    await supabase.from('werkstatt_einstellungen').upsert([
      { schluessel: 'graph_refresh_token', wert: refreshToken },
      { schluessel: 'graph_email',         wert: email },
      { schluessel: 'graph_access_token',  wert: accessToken },
    ], { onConflict: 'schluessel' })

    return NextResponse.redirect(new URL('/einstellungen?success=graph_verbunden', APP_URL))
  } catch (e: any) {
    return NextResponse.redirect(
      new URL(`/einstellungen?error=${encodeURIComponent(e.message)}`, APP_URL)
    )
  }
}
