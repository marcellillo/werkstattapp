import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/graph-client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://werkstatt-app-umber.vercel.app'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', APP_URL))

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL(`/einstellungen?error=${error ?? 'kein_code'}`, APP_URL))
  }

  const { data: rows } = await supabase
    .from('werkstatt_einstellungen')
    .select('schluessel, wert')
    .in('schluessel', ['graph_client_id', 'graph_tenant_id', 'graph_client_secret'])

  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) cfg[r.schluessel] = r.wert

  try {
    const { accessToken, refreshToken } = await exchangeCodeForTokens(
      code,
      cfg.graph_client_id,
      cfg.graph_tenant_id,
      cfg.graph_client_secret,
    )

    // Wer ist eingeloggt? E-Mail-Adresse holen
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const me = await meRes.json()
    const email = me.mail ?? me.userPrincipalName ?? ''

    // Tokens + E-Mail in Einstellungen speichern
    await supabase.from('werkstatt_einstellungen').upsert([
      { schluessel: 'graph_refresh_token', wert: refreshToken },
      { schluessel: 'graph_email', wert: email },
      { schluessel: 'graph_access_token', wert: accessToken },
    ], { onConflict: 'schluessel' })

    return NextResponse.redirect(new URL('/einstellungen?success=graph_verbunden', APP_URL))
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/einstellungen?error=${encodeURIComponent(e.message)}`, APP_URL))
  }
}
