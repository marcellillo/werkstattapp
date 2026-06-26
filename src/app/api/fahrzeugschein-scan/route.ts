export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('bild') as File | null
  if (!file) return NextResponse.json({ error: 'Kein Bild übermittelt' }, { status: 400 })

  const adminSupabase = createAdminClient()
  const { data: rows } = await adminSupabase.from('werkstatt_einstellungen').select('schluessel, wert')
  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  const apiKey = cfg.anthropic_api_key || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein Claude API-Key konfiguriert' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Dies ist ein deutsches Fahrzeugdokument (Zulassungsbescheinigung Teil I oder alter Fahrzeugschein).
Extrahiere alle Fahrzeugdaten und antworte NUR mit validem JSON, kein anderer Text.

Felder im deutschen Fahrzeugschein:
- A = Kennzeichen
- B = Datum der Erstzulassung (TT.MM.JJJJ)
- D.1 = Marke
- D.2/D.3 = Modell / Handelsbezeichnung
- E = Fahrgestellnummer (FIN/VIN, 17 Zeichen)
- P.1 = Hubraum in cm³
- P.2 = Leistung in kW
- J = Fahrzeugklasse (PKW, LKW etc.)

Antworte mit exakt diesem JSON:
{
  "kennzeichen": "WOB-XX 123",
  "marke": "Volkswagen",
  "modell": "Golf 1.6 TDI",
  "fahrgestellnummer": "WVWZZZ1KZAW123456",
  "baujahr": 2010,
  "hubraum": 1598,
  "leistung_kw": 77,
  "erstzulassung": "15.03.2010"
}

Regeln:
- Nur Werte die klar lesbar sind eintragen, sonst null
- kennzeichen in Großbuchstaben mit Bindestrich (z.B. "WOB-XX 123")
- baujahr als vierstellige Zahl aus Erstzulassungsdatum
- Wenn kein Fahrzeugdokument erkennbar: alle Felder null`,
          },
        ],
      }],
    })

    const text = (message.content[0] as any).text?.trim() ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Dokument konnte nicht ausgelesen werden' }, { status: 422 })

    const daten = JSON.parse(jsonMatch[0])
    return NextResponse.json({ daten })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
