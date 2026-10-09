// Kontaktdaten von Kunden: Pflicht beim Anlegen und gemeinsame Aufbereitung von Telefonnummern.

export const KONTAKT_FEHLER =
  'Bitte mindestens eine Handynummer, Telefonnummer oder E-Mail-Adresse angeben – sonst lässt sich der Kunde nicht benachrichtigen (Fertig-Meldung, Freigabe, Rechnung).'

/** true, wenn mindestens ein Kontaktweg ausgefüllt ist */
export const hatKontakt = (...werte: (string | null | undefined)[]) => werte.some(w => (w ?? '').trim().length > 0)

/**
 * Telefonnummer für wa.me / WhatsApp: nur Ziffern in internationaler Form ohne "+" (0151… -> 49151…).
 * Leerer String, wenn daraus keine brauchbare Nummer wird (z. B. zu kurz).
 */
export function waNummer(nummer?: string | null): string {
  if (!nummer) return ''
  // Zusätze wie "(privat)" oder Durchwahlen nach "-"/"/" nicht abschneiden — nur Ziffern und führendes + behalten
  let n = nummer.replace(/[^\d+]/g, '')
  if (n.startsWith('+')) n = n.slice(1)
  else if (n.startsWith('00')) n = n.slice(2)
  else if (n.startsWith('0')) n = '49' + n.slice(1)
  return /^\d{8,15}$/.test(n) ? n : ''
}
