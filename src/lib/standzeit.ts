// Standzeit von Eigenfahrzeugen (Tage im Bestand) und Zahleneingabe für Preise.

export const STANDZEIT_WARNUNG_TAGE = 60
export const STANDZEIT_KRITISCH_TAGE = 90

/** Tage seit dem Eintrag in den Bestand (Anlage des Auftrags), nie negativ */
export function standzeitTage(erstelltAm: string | null | undefined, jetzt: number = Date.now()): number | null {
  const t = Date.parse(erstelltAm ?? '')
  return Number.isFinite(t) ? Math.max(0, Math.floor((jetzt - t) / 86_400_000)) : null
}

export type StandzeitStufe = 'normal' | 'warnung' | 'kritisch'
export const standzeitStufe = (tage: number | null): StandzeitStufe =>
  tage === null ? 'normal' : tage >= STANDZEIT_KRITISCH_TAGE ? 'kritisch' : tage >= STANDZEIT_WARNUNG_TAGE ? 'warnung' : 'normal'

/**
 * Preis aus Texteingabe: "12.500", "12500", "12.500,50", "12 500 €", "12500,5" -> Zahl; ungültig/leer -> null.
 * Ein einzelner Punkt mit genau 3 Stellen danach gilt als Tausenderpunkt ("12.500"), sonst als Dezimalpunkt ("12.5").
 */
export function preisAusText(eingabe: string): number | null {
  let s = eingabe.replace(/[€\s]/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? Math.round(n * 100) / 100 : null
}
