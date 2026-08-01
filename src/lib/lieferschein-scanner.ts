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
              text: `Was ist auf diesem Bild zu sehen? Beschreibe kurz.`,
            },
          ],
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Keine Text-Antwort erhalten')
    }

    const claudeResponse = content.text
    console.log('[Lieferschein] Claude full response:', claudeResponse)

    // Wenn Claude antwortet, dass es etwas sieht = erfolg
    const responseLength = claudeResponse.trim().length
    console.log('[Lieferschein] Response length:', responseLength)

    if (responseLength < 10) {
      // Zu kurze Antwort = Bild zu unklar
      throw new Error('Bild zu unklar oder leer')
    }

    // Versuche Teile zu extrahieren
    const teile: ScannedPart[] = []

    // Suche nach Zahlen + Wort Mustern
    const itemPattern = /(\d+)\s*[x×]\s*([^\n,]+)|(\d+)\s+(stk|st|pieces?|pcs?|set|sets|paar|parts?|qty)[\s:]*([^\n,]+)/gi
    let match

    while ((match = itemPattern.exec(claudeResponse)) !== null) {
      const menge = parseInt(match[1] || match[3] || '1')
      const beschreibung = (match[2] || match[5] || '').trim().replace(/[\d.,;:]/g, '').trim()

      if (beschreibung.length > 2) {
        teile.push({ beschreibung, menge })
      }
    }

    // Fallback: Wenn nichts extrahiert wurde aber Bild erkannt
    if (teile.length === 0) {
      teile.push({
        beschreibung: 'Dokument erkannt - bitte manuell eingeben',
        menge: 1,
      })
    }

    console.log('[Lieferschein] Final parts:', teile)

    return {
      erfolg: true,
      teile,
      confidence: teile.length > 0 ? 0.6 : 0.3,
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
