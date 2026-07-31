import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'

export interface ScannedPart {
  teilenummer?: string
  beschreibung: string
  menge: number
  lieferant?: string
  preis?: number
}

export interface LieferscheinScanResult {
  erfolg: boolean
  fehler?: string
  teile: ScannedPart[]
  lieferdatum?: string
  lieferant?: string
  bestellnummer?: string
  confidence: number // 0-1
}

/**
 * Scannt Lieferschein per AI Vision
 * Extrahiert Teilenummern, Mengen, Beschreibungen
 */
export async function scanLieferschein(
  imagePath: string,
  imageBase64?: string
): Promise<LieferscheinScanResult> {
  const client = new Anthropic()

  // Lade Bild
  let imageData: string
  if (imageBase64) {
    imageData = imageBase64
  } else if (fs.existsSync(imagePath)) {
    const buffer = fs.readFileSync(imagePath)
    imageData = buffer.toString('base64')
  } else {
    return {
      erfolg: false,
      fehler: 'Bild nicht gefunden',
      teile: [],
      confidence: 0,
    }
  }

  // Bestimme Bildtyp
  const ext = path.extname(imagePath).toLowerCase()
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
  if (ext === '.png') mediaType = 'image/png'
  if (ext === '.gif') mediaType = 'image/gif'
  if (ext === '.webp') mediaType = 'image/webp'

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageData,
              },
            },
            {
              type: 'text',
              text: `Analysiere dieses Dokument und extrahiere alle aufgelisteten Teile/Artikel als JSON:

{
  "teile": [
    {
      "teilenummer": "string (optional, z.B. Artikelnummer, SKU)",
      "beschreibung": "string (Teilbezeichnung/Name)",
      "menge": number (Menge/Anzahl),
      "lieferant": "string (optional, Name des Lieferanten)",
      "preis": number (optional, Preis pro Stück in EUR)
    }
  ],
  "lieferdatum": "YYYY-MM-DD (optional)",
  "lieferant": "string (optional, Absender/Lieferant)",
  "bestellnummer": "string (optional, Rechnungs-/Bestellnummer)",
  "confidence": number (0-1, Erkennungssicherheit: 1=sehr sicher, 0=nicht erkannt)
}

WICHTIG:
- Extrahiere ALLE aufgelisteten Teile/Positionen
- Für menge: 0 setzen wenn nicht klar erkannt
- confidence: 0.8-1.0 wenn dies ein Lieferschein/Artikel-Liste ist, sonst 0.1-0.3
- Nur das JSON zurückgeben, keine anderen Kommentare`,
            },
          ],
        },
      ],
    })

    // Parse Antwort
    const content = response.content[0]
    if (content.type !== 'text') {
      console.error('[Lieferschein] Unexpected content type:', content.type)
      return {
        erfolg: false,
        fehler: 'Unerwartete API-Antwort',
        teile: [],
        confidence: 0,
      }
    }

    console.log('[Lieferschein] Claude response:', content.text.substring(0, 200))

    // Extrahiere JSON
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[Lieferschein] No JSON found in response:', content.text)
      return {
        erfolg: false,
        fehler: 'Kein JSON in Antwort gefunden',
        teile: [],
        confidence: 0,
      }
    }

    let parsed
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('[Lieferschein] JSON parse error:', parseError)
      return {
        erfolg: false,
        fehler: 'JSON-Parse-Fehler',
        teile: [],
        confidence: 0,
      }
    }

    console.log('[Lieferschein] Parsed result:', parsed)

    return {
      erfolg: (parsed.confidence || 0) > 0.2 && (parsed.teile?.length || 0) > 0,
      teile: parsed.teile || [],
      lieferdatum: parsed.lieferdatum,
      lieferant: parsed.lieferant,
      bestellnummer: parsed.bestellnummer,
      confidence: parsed.confidence || 0,
    }
  } catch (error: any) {
    return {
      erfolg: false,
      fehler: error.message,
      teile: [],
      confidence: 0,
    }
  }
}

/**
 * Versucht, gescannte Teile zu bestehenden Bestellungen zuzuordnen
 */
export async function matchTeileZuBestellungen(
  teile: ScannedPart[],
  bestellungen: any[]
): Promise<Map<ScannedPart, any>> {
  const matched = new Map<ScannedPart, any>()

  for (const teil of teile) {
    // Versuche Teilenummer zu matchen
    if (teil.teilenummer) {
      const found = bestellungen.find(b => b.teilenummer === teil.teilenummer)
      if (found) {
        matched.set(teil, found)
        continue
      }
    }

    // Versuche Beschreibung zu matchen (fuzzy)
    const beschreibungLower = teil.beschreibung.toLowerCase()
    const found = bestellungen.find(b =>
      b.beschreibung?.toLowerCase().includes(beschreibungLower) ||
      beschreibungLower.includes(b.beschreibung?.toLowerCase() || '')
    )
    if (found) {
      matched.set(teil, found)
    }
  }

  return matched
}
