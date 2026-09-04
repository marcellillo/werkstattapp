export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { arbeiten, fahrzeug, betriebId } = await req.json()
  if (!arbeiten?.trim()) return NextResponse.json({ error: 'Keine Arbeiten angegeben' }, { status: 400 })
  if (!betriebId) return NextResponse.json({ error: 'betriebId erforderlich' }, { status: 400 })

  const { data: betriebCheck } = await supabase
    .from('betrieb_users')
    .select('id')
    .eq('betrieb_id', betriebId)
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!betriebCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: rows } = await supabase
    .from('betrieb_einstellungen')
    .select('schluessel, wert')
    .eq('betrieb_id', betriebId)
  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  const apiKey = cfg.anthropic_api_key || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein Claude API-Key konfiguriert' }, { status: 400 })

  const client = new Anthropic({ apiKey })

  const fahrzeugInfo = fahrzeug
    ? `${fahrzeug.marke ?? ''} ${fahrzeug.modell ?? ''} ${fahrzeug.baujahr ? `(${fahrzeug.baujahr})` : ''} ${fahrzeug.fahrgestellnummer ? `VIN: ${fahrzeug.fahrgestellnummer}` : ''}`.trim()
    : 'unbekanntes Fahrzeug'

  const prompt = `Du bist ein erfahrener Kfz-Meister mit Zugang zu Herstellerdaten und Internetzugang. Schlage die benötigten Ersatzteile vor, prüfe sie gegen die Herstellervorgaben des Fahrzeugs UND suche für jedes Teil per Websuche einen ungefähren aktuellen Marktpreis (in Euro, deutscher Markt, z.B. von Autoteile-Händlern wie kfzteile24, autodoc, pv-kompass o.ä.).

Fahrzeug: ${fahrzeugInfo}
Arbeiten: ${arbeiten}

Für jedes Teil:
1. Ermittle die Herstellervorgabe (Spezifikation, Norm, OE-Nummer falls bekannt)
2. Prüfe ob Aftermarket-Teile zulässig sind oder ob OE-Qualität vorgeschrieben ist
3. Gib konkrete Spezifikationen an (z.B. Ölviskosität, Bremsscheiben-Mindestdicke, Anzugsmoment, Freigabenummer)
4. Suche aktiv im Internet nach einem realistischen, aktuellen Richtpreis für dieses konkrete Teil (Aftermarket-Qualität, sofern zulässig) — nutze das Websuche-Tool, verlasse dich nicht nur auf dein Trainingswissen

Antworte am Ende NUR mit einem JSON-Array (kein Text danach). Format:
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
- preisschaetzung: per Websuche ermittelter Richtwert in Euro als Zahl (kein reiner Trainingswissen-Schätzwert)
- optional: true nur wenn situationsabhängig

Maximal 8 Teile. Nur tatsächlich benötigte Teile.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
    })

    // Bei Websuche besteht die Antwort aus mehreren Content-Blöcken
    // (Suchanfragen, Ergebnisse, Text); der finale Text mit dem JSON steht am Ende.
    const textBlocks = message.content.filter((b: any) => b.type === 'text') as any[]
    const text = textBlocks.map(b => b.text).join('\n').trim()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return NextResponse.json({ error: 'Ungültige Antwort von Claude' }, { status: 500 })

    const teile = JSON.parse(jsonMatch[0])
    return NextResponse.json({ teile })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
