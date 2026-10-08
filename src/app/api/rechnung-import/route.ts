export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { ladeGeheimnis } from '@/lib/betrieb-geheimnisse'
import { verarbeiteRechnungsDatei } from '@/lib/eingangsrechnung'
import { verlangeFinanzrolle } from '@/lib/rollen-server'
import { rateLimit } from '@/lib/rate-limit'

// Manueller Upload einer Lieferantenrechnung (PDF/Foto): wird ausgelesen, in der App abgelegt
// und als Eingangsrechnung angelegt. Pro Aufruf eine Datei.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  let betriebId: string
  try {
    betriebId = await getBetriebIdForUser(supabase, user.id)
  } catch {
    return NextResponse.json({ error: 'Kein Betrieb zugeordnet' }, { status: 403 })
  }

  const rolleFehler = await verlangeFinanzrolle(supabase, user.id, betriebId)
  if (rolleFehler) return rolleFehler
  const limit = await rateLimit(`rechnung-import:${user.id}`, 30, 3600)
  if (limit) return limit

  // API Key (nur serverseitig lesbar), Fallback auf Umgebungsvariable
  const apiKey = (await ladeGeheimnis(betriebId, 'anthropic_api_key')) || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API Key fehlt. Bitte unter Einstellungen → KI-Integration eintragen.' }, { status: 400 })
  }

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('datei')
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  const res = await verarbeiteRechnungsDatei(
    { supabase: createAdminClient(), anthropic: new Anthropic({ apiKey }) },
    {
      betriebId,
      datei: { name: file.name || 'rechnung', contentType: file.type, buffer },
      quelle: 'upload',
      erzwingen: true,
    },
  )

  if (res.status === 'ungueltig') return NextResponse.json({ error: res.fehler }, { status: 400 })
  if (res.status === 'fehler') return NextResponse.json({ error: res.fehler ?? 'Rechnung konnte nicht verarbeitet werden' }, { status: 500 })

  return NextResponse.json({
    erfolg: true,
    rechnungId: res.rechnungId,
    duplikat: res.status === 'duplikat',
    dateiErgaenzt: res.status === 'datei_ergaenzt',
    extrakt: {
      lieferant: res.analyse?.lieferant ?? null,
      rechnungsnummer: res.analyse?.rechnungsnummer ?? null,
      gesamt: res.analyse?.gesamt ?? null,
    },
  })
}
