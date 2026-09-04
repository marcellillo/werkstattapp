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
  vermuteteArbeit?: string
  confidence: number // 0-1
}

/**
 * Scannt Lieferschein per AI Vision
 * Extrahiert Teilenummern, Mengen, Beschreibungen
 */
export async function scanLieferschein(
  imagePath: string,
  imageBase64?: string,
  mimeType?: string
): Promise<LieferscheinScanResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''

  console.log('[Lieferschein] API Key check:')
  console.log('[Lieferschein]   - env value:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NICHT GESETZT')
  console.log('[Lieferschein]   - process.env keys:', Object.keys(process.env).filter(k => k.includes('ANTHROPIC')))

  if (!apiKey) {
    return {
      erfolg: false,
      fehler: 'ANTHROPIC_API_KEY nicht gesetzt in process.env',
      teile: [],
      confidence: 0,
    }
  }

  const client = new Anthropic({ apiKey })

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
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'

  // Wenn mimeType übergeben wurde, verwende diesen
  if (mimeType) {
    if (mimeType.includes('png')) mediaType = 'image/png'
    else if (mimeType.includes('gif')) mediaType = 'image/gif'
    else if (mimeType.includes('webp')) mediaType = 'image/webp'
    else mediaType = 'image/jpeg'
  } else {
    // Fallback: Bildtyp aus Dateiendung bestimmen
    const ext = path.extname(imagePath).toLowerCase()
    if (ext === '.png') mediaType = 'image/png'
    if (ext === '.gif') mediaType = 'image/gif'
    if (ext === '.webp') mediaType = 'image/webp'
  }

  try {
    console.log('[Lieferschein] Starting scan with Claude Vision')

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
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
              text: `Analysiere dieses Dokument und extrahiere ALLE Teile/Artikel mit Preisen.

Formatiere die Ausgabe GENAU so:
- Jedes Teil in einer NEUEN ZEILE
- Format: "MENGE x TEIL-BESCHREIBUNG | PREIS" oder "MENGE TEIL-BESCHREIBUNG | PREIS"
- Wenn kein Preis vorhanden: "MENGE x TEIL-BESCHREIBUNG | 0"
- Beispiele:
  5 x Ölfilter | 25.50
  2 Bremsbeläge | 45.00
  10 x Dichtungen | 0

Nur die Teile mit Mengen und Preisen extrahieren. KEINE Gesamtsummen, KEINE anderen Informationen.

Analysiere zusätzlich als erfahrener Kfz-Meister, welche Arbeit anhand dieser Teile wahrscheinlich durchgeführt wird (z.B. Ölfilter + Luftfilter + Innenraumfilter → "Ölservice / Inspektion durchführen"; Bremsscheiben + Bremsbeläge → "Bremsanlage vorne/hinten erneuern"; Zahnriemen + Wasserpumpe → "Zahnriemen- und Wasserpumpenwechsel").

Gib GANZ AM ENDE, nach allen Teile-Zeilen, genau folgende zusätzliche Zeilen aus (jede einzeln, "unbekannt" falls nicht erkennbar):
ARBEIT: <kurze, konkrete Beschreibung der vermuteten Arbeit>
LIEFERANT: <Name des Lieferanten/Händlers auf dem Dokument>
BESTELLNUMMER: <Bestell- oder Lieferscheinnummer>
LIEFERDATUM: <Datum im Format TT.MM.JJJJ>`,
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
    console.log('[Lieferschein] Claude response:', claudeResponse.substring(0, 300))

    if (!claudeResponse || claudeResponse.trim().length < 10) {
      throw new Error('Keine aussagekräftige Antwort erhalten')
    }

    // Versuche Teile zu extrahieren
    const teile: ScannedPart[] = []

    // Metadaten-Zeilen (ARBEIT/LIEFERANT/BESTELLNUMMER/LIEFERDATUM) herausfiltern
    function extractMeta(label: string): string | undefined {
      const match = claudeResponse.match(new RegExp(`${label}:\\s*(.+)`, 'i'))
      if (!match) return undefined
      const wert = match[1].trim()
      return wert && !/^unbekannt$/i.test(wert) ? wert : undefined
    }
    const vermuteteArbeit = extractMeta('ARBEIT')
    const erkannterLieferant = extractMeta('LIEFERANT')
    const erkannteBestellnummer = extractMeta('BESTELLNUMMER')
    const erkanntesLieferdatum = extractMeta('LIEFERDATUM')

    // Split by lines and look for quantity + description patterns
    const lines = claudeResponse.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (/^(ARBEIT|LIEFERANT|BESTELLNUMMER|LIEFERDATUM):/i.test(trimmed)) continue

      // Trennung: Wenn Preis mit | vorhanden, trennen
      let beschreibungPart = trimmed
      let preisStr = '0'

      if (trimmed.includes('|')) {
        const parts = trimmed.split('|')
        beschreibungPart = parts[0].trim()
        preisStr = parts[1]?.trim() || '0'
      }

      // Pattern 1: "5 x something" or "5x something"
      let match = beschreibungPart.match(/^(\d+)\s*[x×]\s*(.+)/)
      if (match) {
        const menge = parseInt(match[1])
        const beschreibung = match[2].trim()
        const preis = parseFloat(preisStr.replace(',', '.')) || 0
        if (beschreibung.length > 2) {
          teile.push({ beschreibung, menge, preis: preis > 0 ? preis : undefined })
          continue
        }
      }

      // Pattern 2: "5 stk something" or "5 piece something"
      match = beschreibungPart.match(/^(\d+)\s+(stk|st|piece|pcs?|set|paar|parts?|qty|x)[\s:]*(.+)/i)
      if (match) {
        const menge = parseInt(match[1])
        const beschreibung = match[3].trim()
        const preis = parseFloat(preisStr.replace(',', '.')) || 0
        if (beschreibung.length > 2) {
          teile.push({ beschreibung, menge, preis: preis > 0 ? preis : undefined })
          continue
        }
      }

      // Pattern 3: Just a number at start (fallback)
      match = beschreibungPart.match(/^(\d+)\s+(.+)/)
      if (match && !match[2].startsWith('http') && !match[2].startsWith('€') && match[2].length > 3) {
        const menge = parseInt(match[1])
        const beschreibung = match[2].trim()
        const preis = parseFloat(preisStr.replace(',', '.')) || 0
        // Filter out pure numbers and dates
        if (!/^\d+[.,]\d*$/.test(beschreibung) && beschreibung.length > 2) {
          teile.push({ beschreibung, menge, preis: preis > 0 ? preis : undefined })
        }
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
      lieferant: erkannterLieferant,
      bestellnummer: erkannteBestellnummer,
      lieferdatum: erkanntesLieferdatum,
      vermuteteArbeit,
      confidence: teile.length > 0 ? 0.6 : 0.3,
    }
  } catch (error: any) {
    const errorMsg = error?.message || JSON.stringify(error)
    console.error('[Lieferschein] ERROR:', errorMsg)
    console.error('[Lieferschein] Full error:', error)
    return {
      erfolg: false,
      fehler: `Fehler beim Scannen: ${errorMsg.substring(0, 100)}`,
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

    // Versuche Beschreibung zu matchen (fuzzy) — Spalte heißt "bezeichnung", nicht "beschreibung"!
    const beschreibungLower = teil.beschreibung.toLowerCase()
    const found = bestellungen.find(b => {
      const bezeichnungLower = b.bezeichnung?.toLowerCase()
      if (!bezeichnungLower) return false
      return bezeichnungLower.includes(beschreibungLower) || beschreibungLower.includes(bezeichnungLower)
    })
    if (found) {
      matched.set(teil, found)
    }
  }

  return matched
}
