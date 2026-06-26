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

  const prompt = `Du bist ein erfahrener Kfz-Meister. Schlage die benötigten Ersatzteile für folgende Werkstattarbeit vor.

Fahrzeug: ${fahrzeugInfo}
Arbeiten: ${arbeiten}

Antworte NUR mit einem JSON-Array. Kein Text davor oder danach. Format:
[
  {
    "bezeichnung": "Bremsscheiben hinten (Satz)",
    "hinweis": "passend für Fahrzeugtyp prüfen",
    "preisschaetzung": 85,
    "optional": false
  }
]

Regeln:
- Maximal 8 Teile
- Nur tatsächlich benötigte Teile (keine Werbung, keine unnötigen Teile)
- optional=true nur für Teile die situationsabhängig sind (z.B. Bremssattel nur wenn festgesessen)
- preisschaetzung als Zahl in Euro (Richtwert, kein Gewähr)
- hinweis kurz und praktisch (max 60 Zeichen), oder null wenn nichts Wichtiges`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
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
