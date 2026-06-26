export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { refreshAccessToken, fetchUnreadMessages, markMessageAsRead, fetchAttachments } from '@/lib/graph-client'

// Vercel Cron ruft diesen GET-Endpunkt auf
export async function GET(req: Request) {
  // Vercel setzt automatisch CRON_SECRET als Authorization-Header
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: rows } = await supabase.from('werkstatt_einstellungen').select('schluessel, wert')
  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  const { graph_client_id, graph_tenant_id, graph_client_secret, graph_refresh_token } = cfg
  if (!graph_refresh_token) {
    return NextResponse.json({ error: 'Microsoft-Konto nicht verbunden' }, { status: 400 })
  }

  const apiKey = cfg.anthropic_api_key || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Kein Claude API-Key' }, { status: 400 })
  }

  try {
    // POST /api/email-sync intern aufrufen — gleiche Logik, kein Duplikat
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://werkstatt-app-umber.vercel.app'
    const res = await fetch(`${baseUrl}/api/email-sync`, {
      method: 'POST',
      headers: {
        // Service-Role-Key als internen Auth-Bypass verwenden
        'x-cron-internal': process.env.CRON_SECRET ?? 'cron',
      },
    })
    const data = await res.json()

    await supabase.from('werkstatt_einstellungen').upsert(
      { schluessel: 'letzter_auto_sync', wert: new Date().toISOString() },
      { onConflict: 'schluessel' }
    )

    return NextResponse.json({ erfolg: true, ...data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
