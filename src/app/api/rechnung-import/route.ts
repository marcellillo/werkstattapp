import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  // API Key aus DB lesen, Fallback auf .env.local
  const { data: keyRow } = await supabase
    .from('werkstatt_einstellungen')
    .select('wert')
    .eq('schluessel', 'anthropic_api_key')
    .maybeSingle()
  const apiKey = keyRow?.wert || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Anthropic API Key fehlt. Bitte unter Einstellungen → KI-Integration eintragen.' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey })

  const formData = await req.formData()
  const file = formData.get('datei') as File | null
  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })

  // Datei als Base64
  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const isPdf = file.type === 'application/pdf'
  const mediaType = isPdf ? 'application/pdf' : (file.type as 'image/jpeg' | 'image/png' | 'image/webp')

  // Claude analysiert die Rechnung
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: [
          isPdf
            ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
            : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } },
          {
            type: 'text',
            text: `Analysiere diese Lieferantenrechnung und extrahiere alle relevanten Daten.

Antworte NUR mit einem JSON-Objekt in diesem Format (kein Markdown, kein Text darum herum):
{
  "lieferant": "Firmenname des Lieferanten",
  "rechnungsnummer": "Rechnungsnummer oder null",
  "datum": "YYYY-MM-DD oder null",
  "gesamt": 123.45,
  "positionen": [
    {
      "bezeichnung": "Artikelbezeichnung",
      "teilenummer": "Teilenummer oder null",
      "menge": 1,
      "einzelpreis": 49.99,
      "gesamtpreis": 49.99
    }
  ]
}

Wichtig:
- Alle Preise als Zahlen ohne Währungssymbol
- Mengen als Zahlen (z.B. 2 statt "2 Stück")
- Wenn ein Wert nicht lesbar ist: null
- Teilenummern/OEM-Nummern unbedingt mit übernehmen`,
          },
        ],
      },
    ],
  })

  // JSON aus der Antwort extrahieren
  const textBlock = message.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    return NextResponse.json({ error: 'Keine Antwort von Claude' }, { status: 500 })
  }

  let extrakt: any
  try {
    const cleaned = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    extrakt = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Claude Antwort konnte nicht geparst werden', raw: textBlock.text }, { status: 500 })
  }

  // Dedup-Check vor dem Speichern
  if (extrakt.rechnungsnummer) {
    const { data: exist } = await supabase.from('rechnungen')
      .select('id').eq('rechnungsnummer', extrakt.rechnungsnummer).maybeSingle()
    if (exist) return NextResponse.json({ erfolg: true, rechnungId: exist.id, extrakt, duplikat: true })
  }

  // Rechnung speichern
  const { data: rechnung, error: rErr } = await supabase
    .from('rechnungen')
    .insert({
      lieferant: extrakt.lieferant,
      rechnungsnummer: extrakt.rechnungsnummer,
      datum: extrakt.datum,
      gesamt: extrakt.gesamt,
    })
    .select('id')
    .single()

  if (rErr || !rechnung) {
    return NextResponse.json({ error: 'Rechnung konnte nicht gespeichert werden', detail: rErr?.message }, { status: 500 })
  }

  // Positionen speichern
  if (extrakt.positionen?.length) {
    await supabase.from('rechnung_positionen').insert(
      extrakt.positionen.map((p: any) => ({
        rechnung_id: rechnung.id,
        bezeichnung: p.bezeichnung,
        teilenummer: p.teilenummer,
        menge: p.menge,
        einzelpreis: p.einzelpreis,
        gesamtpreis: p.gesamtpreis,
      }))
    )
  }

  return NextResponse.json({ erfolg: true, rechnungId: rechnung.id, extrakt })
}
