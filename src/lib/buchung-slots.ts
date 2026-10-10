// Freie Zeiten für die Online-Terminbuchung -- gemeinsam für die öffentliche Abfrage (/api/buchen/slots)
// und die Prüfung beim Buchen (/api/buchen). Reine Rechenfunktionen ohne Datenbankzugriff.

export interface BuchungKonfig {
  beginn: string        // früheste Startzeit 'HH:MM'
  ende: string          // spätestes Ende eines Termins 'HH:MM'
  slotMin: number       // Raster der Startzeiten in Minuten
  puffer: number        // Pause nach jedem Termin in Minuten
  kapazitaet: number    // wie viele Termine gleichzeitig laufen dürfen (z. B. Mitarbeiter/Bühnen)
  geschlossen: string[] // freie Tage 'YYYY-MM-DD' (Urlaub, Feiertage)
}

// Entspricht den bisherigen Zeiten der Website: Mo–Fr 8:00–16:30, 30-Minuten-Raster, 15 Minuten Puffer
export const BUCHUNG_STANDARD: BuchungKonfig = { beginn: '08:00', ende: '16:30', slotMin: 30, puffer: 15, kapazitaet: 2, geschlossen: [] }

export interface Belegung { uhrzeit: string | null; dauer_minuten: number | null }

const ZEIT = /^([01]\d|2[0-3]):[0-5]\d$/
const TAG = /^\d{4}-\d{2}-\d{2}$/

export const inMinuten = (zeit: string | null | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(zeit ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
export const alsUhrzeit = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Einstellungen (Textwerte aus betrieb_einstellungen) -> gültige Konfiguration; ungültiges fällt auf den Standard zurück */
export function konfigAusEinstellungen(werte: Record<string, string | null | undefined>): BuchungKonfig {
  const k = { ...BUCHUNG_STANDARD, geschlossen: [] as string[] }
  const beginn = (werte.buchung_beginn ?? '').trim()
  const ende = (werte.buchung_ende ?? '').trim()
  if (ZEIT.test(beginn) && ZEIT.test(ende) && inMinuten(ende)! > inMinuten(beginn)!) { k.beginn = beginn; k.ende = ende }
  const kap = Number((werte.buchung_kapazitaet ?? '').trim())
  if (Number.isInteger(kap) && kap >= 1 && kap <= 10) k.kapazitaet = kap
  k.geschlossen = (werte.buchung_geschlossen ?? '').split(/[,;\s]+/).filter(t => TAG.test(t) && !Number.isNaN(Date.parse(t + 'T00:00:00Z')))
  return k
}

/** Mo–Fr (Wochentag des Kalendertags, unabhängig von der Zeitzone des Servers) */
export function istArbeitstag(datum: string): boolean {
  const tag = new Date(datum + 'T12:00:00Z').getUTCDay()
  return tag >= 1 && tag <= 5
}

/** Dauer in Minuten: 30–480, auf 15 Minuten aufgerundet; ungültig -> 60 */
export function dauerBegrenzen(dauer: unknown): number {
  const n = Number(dauer)
  if (!Number.isFinite(n) || n <= 0) return 60
  return Math.min(480, Math.max(30, Math.ceil(n / 15) * 15))
}

/** Aktueller Tag und Uhrzeit (in Minuten) in deutscher Zeit */
export function jetztBerlin(jetzt: Date = new Date()): { tag: string; minuten: number } {
  const tag = jetzt.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
  const zeit = jetzt.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false })
  return { tag, minuten: inMinuten(zeit) ?? 0 }
}

function intervalle(belegungen: Belegung[], puffer: number): [number, number][] {
  const liste: [number, number][] = []
  for (const b of belegungen) {
    const start = inMinuten(b.uhrzeit)
    if (start === null) continue // Termin ohne Uhrzeit blockiert keine bestimmte Zeit
    liste.push([start, start + (b.dauer_minuten && b.dauer_minuten > 0 ? b.dauer_minuten : 60) + puffer])
  }
  return liste
}

/** Höchste Zahl gleichzeitiger Termine innerhalb von [von, bis) */
function maxAuslastung(liste: [number, number][], von: number, bis: number): number {
  const betroffen = liste.filter(([a, b]) => a < bis && b > von)
  const punkte = [von, ...betroffen.map(([a]) => a).filter(a => a > von && a < bis)]
  let max = 0
  for (const p of punkte) max = Math.max(max, betroffen.filter(([a, b]) => a <= p && b > p).length)
  return max
}

/** Startzeiten ('HH:MM'), zu denen ein Termin dieser Dauer noch Platz hat */
export function freieZeiten(
  datum: string, dauerMin: number, belegungen: Belegung[], konfig: BuchungKonfig, jetzt = jetztBerlin(),
): string[] {
  if (!TAG.test(datum) || !istArbeitstag(datum) || konfig.geschlossen.includes(datum) || datum < jetzt.tag) return []
  const dauer = dauerBegrenzen(dauerMin)
  const liste = intervalle(belegungen, konfig.puffer)
  const ergebnis: string[] = []
  const ende = inMinuten(konfig.ende)!
  for (let s = inMinuten(konfig.beginn)!; s + dauer <= ende; s += konfig.slotMin) {
    if (datum === jetzt.tag && s < jetzt.minuten + 60) continue // heute: mindestens eine Stunde Vorlauf
    if (maxAuslastung(liste, s, s + dauer + konfig.puffer) < konfig.kapazitaet) ergebnis.push(alsUhrzeit(s))
  }
  return ergebnis
}

/** Ist dieser Termin (samt allen übrigen) mehr als die erlaubte Zahl gleichzeitiger Termine? Prüfung nach dem Eintragen (Doppelbuchung) */
export function ueberbucht(uhrzeit: string, dauerMin: number, alleBelegungen: Belegung[], konfig: BuchungKonfig): boolean {
  const start = inMinuten(uhrzeit)
  if (start === null) return false
  const dauer = dauerBegrenzen(dauerMin)
  return maxAuslastung(intervalle(alleBelegungen, konfig.puffer), start, start + dauer + konfig.puffer) > konfig.kapazitaet
}
