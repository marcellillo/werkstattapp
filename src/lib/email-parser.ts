// E-Mail Parser für Lieferanten-Mails (PV Automotive, Nora, eBay)

export type ErkannterStatus = 'bestellt' | 'unterwegs' | 'geliefert' | 'unbekannt'

// ── Rechnungs-Erkennung ──────────────────────────────────────

export interface ParsedRechnung {
  istRechnung: true
  lieferant: string
  rechnungsnummer: string | null
  datum: string | null
  faelligAm: string | null
  gesamt: number | null
  positionen: { bezeichnung: string; teilenummer: string | null; menge: number; einzelpreis: number | null; gesamtpreis: number | null }[]
}

const RECHNUNG_PATTERNS = [
  /ihre\s+rechnung/i, /rechnung\s+nr/i, /rechnungsnummer/i, /invoice\s+no/i,
  /invoice\s+number/i, /zu\s+zahlen/i, /zahlungsziel/i, /fälligk/i,
  /bitte\s+überweisen/i, /zahlbar\s+bis/i, /rechnungsbetrag/i,
]

const RECHNUNGSNR_PATTERNS = [
  /re(?:chnungs)?(?:[-.\s]?nr\.?|nummer)[:\s]+([A-Z0-9\-\/]{3,20})/i,
  /invoice\s+(?:no\.?|number)[:\s]+([A-Z0-9\-\/]{3,20})/i,
  /\b(RE[-\/]?\d{4,10})\b/i,
]

const FAELLIG_PATTERNS = [
  /(?:zahlungsziel|zahlbar bis|fällig am|fälligkeit|due date)[:\s]+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
]

const DATUM_PATTERNS = [
  /(?:rechnungsdatum|datum|date)[:\s]+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
  /(\d{1,2}\.\d{1,2}\.\d{4})/,
]

const GESAMT_PATTERNS = [
  /(?:gesamt(?:betrag)?|total|summe|zu\s+zahlen|rechnungsbetrag)[:\s]*(\d+[.,]\d{2})\s*€/i,
  /(\d+[.,]\d{2})\s*€\s*(?:gesamt|total|brutto)/i,
]

function parseGermanDate(s: string): string | null {
  const m = s.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/)
  if (!m) return null
  const [, d, mo, y] = m
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function istRechnungsEmail(betreff: string, inhalt: string): boolean {
  const text = `${betreff} ${inhalt}`
  return RECHNUNG_PATTERNS.some(p => p.test(text))
}

export function parseRechnung(params: { absender: string; betreff: string; inhalt: string }): ParsedRechnung {
  const { absender, betreff, inhalt } = params
  const volltext = `${betreff}\n${inhalt}`

  const lieferant = absender.split('@')[1]?.split('.')[0] ?? absender

  let rechnungsnummer: string | null = null
  for (const p of RECHNUNGSNR_PATTERNS) {
    const m = volltext.match(p)
    if (m) { rechnungsnummer = m[1]; break }
  }

  let datum: string | null = null
  for (const p of DATUM_PATTERNS) {
    const m = volltext.match(p)
    if (m) { datum = parseGermanDate(m[1]); break }
  }

  let faelligAm: string | null = null
  for (const p of FAELLIG_PATTERNS) {
    const m = volltext.match(p)
    if (m) { faelligAm = parseGermanDate(m[1]); break }
  }

  let gesamt: number | null = null
  for (const p of GESAMT_PATTERNS) {
    const m = volltext.match(p)
    if (m) { gesamt = parseFloat(m[1].replace(',', '.')); break }
  }
  // Fallback: größter Betrag im Text
  if (gesamt === null) {
    const alle = [...volltext.matchAll(/(\d+[.,]\d{2})\s*€/g)]
      .map(m => parseFloat(m[1].replace(',', '.')))
    if (alle.length) gesamt = Math.max(...alle)
  }

  // Positionen aus Tabellenzeilen
  const positionen: ParsedRechnung['positionen'] = []
  for (const zeile of volltext.split('\n').map(z => z.trim()).filter(z => z.length > 4)) {
    const m = zeile.match(/^(\d+)\s*x?\s+(.{4,60?}?)[\s\t]+(\d+[.,]\d{2})\s*€?\s*[\s\t]+(\d+[.,]\d{2})\s*€/)
    if (m) {
      positionen.push({
        bezeichnung: m[2].trim(),
        teilenummer: null,
        menge: parseInt(m[1]),
        einzelpreis: parseFloat(m[3].replace(',', '.')),
        gesamtpreis: parseFloat(m[4].replace(',', '.')),
      })
    }
  }

  return { istRechnung: true, lieferant, rechnungsnummer, datum, faelligAm, gesamt, positionen }
}

export interface ParsedEmail {
  lieferant: string
  status: ErkannterStatus
  auftragsnummer: string | null  // unsere AUF-XXXX-XXX Nummer im Betreff
  kennzeichen: string | null
  teile: ParsedTeil[]
}

export interface ParsedTeil {
  bezeichnung: string
  teilenummer: string | null
  menge: number
  einzelpreis: number | null
}

// ── Lieferanten-Konfiguration ────────────────────────────────

const LIEFERANTEN: { name: string; domains: string[]; absender: string[] }[] = [
  {
    name: 'PV Automotive',
    domains: ['pv-automotive.de', 'pvautomotive.de'],
    absender: ['pv', 'pv automotive'],
  },
  {
    name: 'Nora Zentrum',
    domains: ['nora.de', 'nora-autoteile.de', 'nora-zentrum.de', 'norazentrum.de'],
    absender: ['nora'],
  },
  {
    name: 'eBay',
    domains: ['ebay.de', 'ebay.com', 'messages.ebay.de'],
    absender: ['ebay'],
  },
]

// ── Status-Erkennung aus Betreff / Text ──────────────────────

const STATUS_PATTERNS: { status: ErkannterStatus; patterns: RegExp[] }[] = [
  {
    status: 'geliefert',
    patterns: [
      /zugestellt/i, /geliefert/i, /wurde.*geliefert/i, /paket.*angekommen/i,
      /delivery.*complete/i, /delivered/i, /ihr paket ist da/i,
    ],
  },
  {
    status: 'unterwegs',
    patterns: [
      /versandt/i, /versendet/i, /auf dem weg/i, /tracking/i, /sendungsverfolgung/i,
      /paket.*unterwegs/i, /shipped/i, /dispatched/i, /lieferavis/i, /versandbestätigung/i,
    ],
  },
  {
    status: 'bestellt',
    patterns: [
      /bestellbestätigung/i, /auftragsbestätigung/i, /ihre bestellung/i,
      /order confirmation/i, /bestellung.*eingegangen/i, /wir haben.*bestellung/i,
    ],
  },
]

// ── Teilenummer-Pattern ──────────────────────────────────────

const TEILENUMMER_PATTERNS = [
  /(?:art\.?[-\s]?nr\.?|artikelnummer|teilenummer|ref\.?|OE)[:\s]+([A-Z0-9\-\.\/]{4,20})/gi,
  /\b([A-Z]{1,4}[-\s]?\d{4,10}[-\s]?[A-Z0-9]*)\b/g,
]

// ── Auftragsnummer-Pattern (unsere interne Nummer) ───────────

const AUFTRAGSNR_PATTERN = /AUF[-\s]?(\d{4})[-\s]?(\d{3,4})/i
const KENNZEICHEN_PATTERN = /\b([A-ZÄÖÜ]{1,3}[-\s][A-Z]{1,2}[-\s]?\d{1,4}[HE]?)\b/i

// ── Preis-Pattern ────────────────────────────────────────────

const PREIS_PATTERN = /(\d+[.,]\d{2})\s*€/g

// ── Hauptfunktion ────────────────────────────────────────────

export function parseEmail(params: {
  absender: string
  betreff: string
  inhalt: string
}): ParsedEmail {
  const { absender, betreff, inhalt } = params
  const volltext = `${betreff} ${inhalt}`.toLowerCase()
  const volltextRaw = `${betreff} ${inhalt}`

  // Lieferant erkennen
  const lieferant = erkenneLieferant(absender)

  // Status erkennen
  const status = erkenneStatus(volltext)

  // Auftragsnummer + Kennzeichen
  const auftragsnummer = volltextRaw.match(AUFTRAGSNR_PATTERN)?.[0]?.toUpperCase() ?? null
  const kennzeichen = volltextRaw.match(KENNZEICHEN_PATTERN)?.[1] ?? null

  // Teile extrahieren
  const teile = extrahiereTeile(volltextRaw, lieferant)

  return { lieferant, status, auftragsnummer, kennzeichen, teile }
}

function erkenneLieferant(absender: string): string {
  const abs = absender.toLowerCase()
  for (const l of LIEFERANTEN) {
    if (l.domains.some(d => abs.includes(d))) return l.name
    if (l.absender.some(a => abs.includes(a))) return l.name
  }
  return 'Unbekannt'
}

function erkenneStatus(text: string): ErkannterStatus {
  for (const { status, patterns } of STATUS_PATTERNS) {
    if (patterns.some(p => p.test(text))) return status
  }
  return 'unbekannt'
}

function extrahiereTeile(text: string, lieferant: string): ParsedTeil[] {
  const teile: ParsedTeil[] = []

  // Tabellen-ähnliche Strukturen erkennen (Zeile mit Menge + Bezeichnung)
  const zeilen = text.split('\n').map(z => z.trim()).filter(z => z.length > 5)

  for (const zeile of zeilen) {
    // Muster: "2x Bremsbeläge vorne ... 45,90 €" oder "1 Ölfilter ... 8,50 €"
    const mengeMatch = zeile.match(/^(\d+)\s*x?\s+(.{5,60?}?)(?:\s+[\d.,]+\s*€)?$/)
    if (mengeMatch) {
      const menge = parseInt(mengeMatch[1])
      const bezeichnung = mengeMatch[2].trim()
      if (menge > 0 && menge < 100 && bezeichnung.length > 3) {
        // Teilenummer in der Zeile suchen
        let teilenummer: string | null = null
        for (const pat of TEILENUMMER_PATTERNS) {
          pat.lastIndex = 0
          const m = pat.exec(zeile)
          if (m) { teilenummer = m[1]; break }
        }

        // Preis in der Zeile
        const preisMatch = zeile.match(/(\d+[.,]\d{2})\s*€/)
        const einzelpreis = preisMatch
          ? parseFloat(preisMatch[1].replace(',', '.'))
          : null

        teile.push({ bezeichnung, teilenummer, menge, einzelpreis })
      }
    }
  }

  // Fallback: wenn nichts erkannt, Betreff als Bezeichnung nutzen
  if (teile.length === 0 && lieferant !== 'Unbekannt') {
    teile.push({ bezeichnung: 'Siehe E-Mail', teilenummer: null, menge: 1, einzelpreis: null })
  }

  return teile
}
