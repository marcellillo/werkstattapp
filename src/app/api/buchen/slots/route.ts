export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { dauerBegrenzen, freieZeiten, istArbeitstag, jetztBerlin } from '@/lib/buchung-slots'
import { getBuchungBetriebId, ladeBelegungen, ladeBuchungKonfig } from '@/lib/buchung-server'

// GET /api/buchen/slots?von=YYYY-MM-DD&bis=YYYY-MM-DD&dauer=60
// Öffentlich (Website): welche Startzeiten sind an den Tagen noch frei? Es werden nur Uhrzeiten geliefert, keine Termin- oder Kundendaten.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const TAG = /^\d{4}-\d{2}-\d{2}$/
const plusTage = (tag: string, n: number) => { const d = new Date(tag + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

export async function GET(req: NextRequest) {
  const headers = { ...CORS, 'Cache-Control': 'no-store' }
  const limit = await rateLimit(`slots:ip:${clientIp(req)}`, 240, 3600)
  if (limit) return NextResponse.json(await limit.json(), { status: 429, headers: { ...headers, 'Retry-After': '600' } })

  const p = req.nextUrl.searchParams
  const heute = jetztBerlin().tag
  const von = p.get('von') ?? heute
  const bis = p.get('bis') ?? plusTage(von, 6)
  const gueltig = (t: string) => TAG.test(t) && !Number.isNaN(Date.parse(t + 'T00:00:00Z'))
  if (!gueltig(von) || !gueltig(bis) || bis < von) return NextResponse.json({ error: 'Ungültiger Zeitraum' }, { status: 400, headers })
  const tageAnzahl = (Date.parse(bis + 'T00:00:00Z') - Date.parse(von + 'T00:00:00Z')) / 86_400_000 + 1
  if (tageAnzahl > 14) return NextResponse.json({ error: 'Höchstens 14 Tage auf einmal' }, { status: 400, headers })
  if (von > plusTage(heute, 400)) return NextResponse.json({ error: 'Zu weit in der Zukunft' }, { status: 400, headers })
  const dauer = dauerBegrenzen(p.get('dauer'))

  const betriebId = await getBuchungBetriebId()
  if (!betriebId) return NextResponse.json({ error: 'Keine Werkstatt für Online-Buchungen konfiguriert' }, { status: 500, headers })
  const [konfig, belegt] = await Promise.all([ladeBuchungKonfig(betriebId), ladeBelegungen(betriebId, von, bis)])

  const tage: Record<string, { geschlossen: boolean; frei: string[] }> = {}
  for (let i = 0; i < tageAnzahl; i++) {
    const tag = plusTage(von, i)
    const geschlossen = !istArbeitstag(tag) || konfig.geschlossen.includes(tag)
    tage[tag] = { geschlossen, frei: geschlossen ? [] : freieZeiten(tag, dauer, belegt[tag] ?? [], konfig) }
  }
  return NextResponse.json({ dauer, beginn: konfig.beginn, ende: konfig.ende, tage }, { headers })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
