export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

// Vercel Cron ruft diesen GET-Endpunkt auf. Die eigentliche Sync-Logik lebt
// in /api/email-sync und entscheidet dort selbst, pro Betrieb, ob E-Mail-Sync
// aktiv und Microsoft verbunden ist (siehe syncBetrieb/ladeSyncConfig dort) —
// dieser Cron-Wrapper braucht daher keine eigene Vorab-Pruefung von Zugangsdaten
// mehr (die ohnehin nie fuer "einen" globalen Betrieb galt, sondern zufaellig
// fuer den zuerst konfigurierten).
export async function GET(req: Request) {
  // Vercel setzt automatisch CRON_SECRET als Authorization-Header
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    return NextResponse.json({ erfolg: true, ...data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
