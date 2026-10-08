export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { syncAlleBetriebe } from '@/lib/email-sync'
import { serverFehler } from '@/lib/api-fehler'

// Täglicher Abruf (siehe vercel.json). Vercel schickt "Authorization: Bearer $CRON_SECRET".
// Ohne gesetztes CRON_SECRET wird jeder Aufruf abgewiesen (nicht "offen lassen").
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const betriebe = await syncAlleBetriebe()
    return NextResponse.json({ erfolg: true, betriebe })
  } catch (e: any) {
    return serverFehler(e, 'cron/email-sync')
  }
}
