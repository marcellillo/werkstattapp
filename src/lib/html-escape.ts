// HTML-Escape für selbst gebauten HTML-Code (E-Mails). Alles, was ein Nutzer oder ein Kunde eintippen kann
// (Namen, Bemerkungen, Firmenangaben), muss vor dem Einsetzen in HTML durch diese Funktion laufen -- sonst kann
// jemand z. B. Links, Bilder oder Formulare in eine E-Mail einschleusen, die im Namen der Werkstatt verschickt wird.

export function esc(wert: unknown): string {
  return String(wert ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Alle Text-Felder eines Objekts (flach) escapen; Zahlen und andere Typen bleiben unverändert. */
export function escObjekt<T extends Record<string, any>>(objekt: T | null | undefined): T {
  const aus: Record<string, any> = {}
  for (const [k, v] of Object.entries(objekt ?? {})) aus[k] = typeof v === 'string' ? esc(v) : v
  return aus as T
}

/** Logo nur als eingebettetes Bild (data:) oder https-Adresse zulassen -- sonst weglassen. */
export function sichereBildQuelle(quelle: string | null | undefined): string | null {
  if (!quelle) return null
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(quelle)) return quelle
  if (/^https:\/\/[^\s"'<>]+$/.test(quelle)) return esc(quelle)
  return null
}

/** Text für Kopfzeilen (Betreff, Absendername): keine Zeilenumbrüche, keine spitzen Klammern/Anführungszeichen. */
export function kopfzeilenText(wert: unknown, maxLaenge = 120): string {
  return String(wert ?? '').replace(/[\r\n<>"]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLaenge)
}
