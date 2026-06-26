export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { arbeiten, fahrzeug } = await req.json()
  if (!arbeiten?.trim()) return NextResponse.json({ error: 'Keine Arbeiten angegeben' }, { status: 400 })

  const adminSupabase = createAdminClient()
  const { data: rows } = await adminSupabase.from('werkstatt_einstellungen').select('schluessel, wert')
  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  const apiKey = cfg.anthropic_api_key || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein Claude API-Key konfiguriert' }, { status: 400 })

  const client = new Anthropic({ apiKey })

  const fahrzeugInfo = fahrzeug
    ? `${fahrzeug.marke ?? ''} ${fahrzeug.modell ?? ''} ${fahrzeug.baujahr ? `(${fahrzeug.baujahr})` : ''} ${fahrzeug.fahrgestellnummer ? `VIN: ${fahrzeug.fahrgestellnummer}` : ''}`.trim()
    : 'unbekanntes Fahrzeug'

  const prompt = `Du bist ein erfahrener Kfz-Meister mit Zugang zu Herstellerdaten. Schlage die benötigten Ersatzteile vor und prüfe sie gegen die Herstellervorgaben des Fahrzeugs.

Fahrzeug: ${fahrzeugInfo}
Arbeiten: ${arbeiten}

Für jedes Teil:
1. Ermittle die Herstellervorgabe (Spezifikation, Norm, OE-Nummer falls bekannt)
2. Prüfe ob Aftermarket-Teile zulässig sind oder ob OE-Qualität vorgeschrieben ist
3. Gib konkrete Spezifikationen an (z.B. Ölviskosität, Bremsscheiben-Mindestdicke, Anzugsmoment, Freigabenummer)

Antworte NUR mit einem JSON-Array. Kein Text davor oder danach. Format:
[
  {
    "bezeichnung": "Motoröl 5W-30",
    "hinweis": "Freigabe VW 504.00 / 507.00 zwingend erforderlich",
    "herstellervorgabe": "VW-Norm 504.00/507.00, Longlife-fähig, min. 4,5 Liter",
    "spezifikation": "5W-30 ACEA C3, API SN",
    "oe_qualitaet_erforderlich": false,
    "preisschaetzung": 45,
    "optional": false
  }
]

Felder:
- bezeichnung: Teilename inkl. Menge/Satz
- hinweis: wichtigster Praxishinweis (max 70 Zeichen)
- herstellervorgabe: exakte Norm/Freigabe/Vorgabe des Herstellers (null wenn nicht bekannt)
- spezifikation: technische Kenndaten (Viskosität, Maße, Norm etc.), null wenn nicht relevant
- oe_qualitaet_erforderlich: true wenn Hersteller ausdrücklich OE oder gleichwertig vorschreibt
- preisschaetzung: Richtwert in Euro als Zahl
- optional: true nur wenn situationsabhängig

Maximal 8 Teile. Nur tatsächlich benötigte Teile.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (message.content[0] as any).text?.trim() ?? ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return NextResponse.json({ error: 'Ungültige Antwort von Claude' }, { status: 500 })

    const teile = JSON.parse(jsonMatch[0])
    return NextResponse.json({ teile })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
