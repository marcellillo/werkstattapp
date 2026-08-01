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
    console.log('[Lieferschein] Starting scan with image type:', mediaType, 'data length:', imageData.length)

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
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
              text: `Beschreibe ALL TEXT im Bild. Listen Sie jeden Artikel/Teil auf:

Beispiel Response:
- Ölfilter, 2 Stück
- Bremsbeläge, 1 Set
- Luftfilter, 3 Stück

Antworte mit einfacher Liste, ein Artikel pro Zeile.`,
            },
          ],
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Keine Text-Antwort erhalten')
    }

    console.log('[Lieferschein] Claude full response:', content.text)

    // Parse aus Text
    const lines = content.text.split('\n').filter(l => l.trim())
    const teile: ScannedPart[] = []

    for (const line of lines) {
      if (!line.match(/^[-•\s]/)) continue

      const cleaned = line.replace(/^[-•\s]+/, '').trim()
      if (!cleaned) continue

      // Versuche Menge zu extrahieren
      let menge = 1
      const mengeMatch = cleaned.match(/(\d+)\s*(stk|st|piece|pcs|x|menge|qty|set|sets|paar)/i)
      if (mengeMatch) {
        menge = parseInt(mengeMatch[1])
      }

      const beschreibung = cleaned.replace(/\d+\s*(stk|st|piece|pcs|x|menge|qty|set|sets|paar).*/i, '').trim()

      if (beschreibung.length > 2) {
        teile.push({
          beschreibung,
          menge,
        })
      }
    }

    console.log('[Lieferschein] Extracted parts:', teile)

    return {
      erfolg: teile.length > 0,
      teile,
      confidence: teile.length > 0 ? 0.7 : 0,
    }
  } catch (error: any) {
    console.error('[Lieferschein] Error:', error.message, error)
    return {
      erfolg: false,
      fehler: `Fehler beim Scannen: ${error.message}`,
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
