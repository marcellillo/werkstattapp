// Zahlungsziel und Fälligkeit von Kundenrechnungen (gemeinsam für Rechnung, PDF, Buchhaltung und Dashboard).

export const ZAHLUNGSZIEL_STANDARD_TAGE = 14

/** Zahlungsziel in Tagen aus der Einstellung; ungültige/fehlende Werte ergeben den Standard (14). 0 = sofort fällig. */
export function zahlungszielTage(wert: unknown): number {
  const text = String(wert ?? '').trim()
  if (!/^\d{1,2}$/.test(text)) return ZAHLUNGSZIEL_STANDARD_TAGE
  const n = Number.parseInt(text, 10)
  return n >= 0 && n <= 90 ? n : ZAHLUNGSZIEL_STANDARD_TAGE
}

/** Kalendertag (YYYY-MM-DD) in deutscher Zeit */
export function tagBerlin(d: Date | string = new Date()): string {
  return new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

export function plusTage(tag: string, n: number): string {
  const d = new Date(tag + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

type RechnungKurz = { status?: string | null; faellig_am?: string | null; erstellt_am: string }

/**
 * Fälligkeitstag einer Rechnung. Neue Rechnungen haben ihn gespeichert; ältere (ohne Datum) galten bisher
 * immer als "Rechnungsdatum + 14 Tage" -- genau so steht es auch auf ihnen gedruckt.
 */
export function faelligkeit(r: RechnungKurz): string {
  return r.faellig_am ? r.faellig_am.slice(0, 10) : plusTage(tagBerlin(r.erstellt_am), ZAHLUNGSZIEL_STANDARD_TAGE)
}

/** Offene Rechnung, deren Fälligkeitstag vor heute liegt */
export function istUeberfaellig(r: RechnungKurz, heute: string = tagBerlin()): boolean {
  return r.status === 'offen' && faelligkeit(r) < heute
}

/** Für den Ausdruck: gespeichertes Zahlungsziel, sonst wie bisher Rechnungsdatum + 14 Tage (alte Rechnungen bleiben unverändert) */
export function zahlungszielDatum(r: { faellig_am?: string | null; erstellt_am: string }): Date {
  return r.faellig_am
    ? new Date(r.faellig_am.slice(0, 10) + 'T12:00:00')
    : new Date(new Date(r.erstellt_am).getTime() + ZAHLUNGSZIEL_STANDARD_TAGE * 86_400_000)
}

/** Wie lange ist es her? "heute", "gestern", "vor 5 Tagen" */
export function vorTagen(zeit: string, heute: string = tagBerlin()): string {
  const tage = Math.round((Date.parse(heute + 'T12:00:00Z') - Date.parse(tagBerlin(zeit) + 'T12:00:00Z')) / 86_400_000)
  if (tage <= 0) return 'heute'
  if (tage === 1) return 'gestern'
  return `vor ${tage} Tagen`
}
