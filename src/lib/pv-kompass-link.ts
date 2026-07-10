/**
 * Generiert einen Deep Link zu PV Kompass für die Teil-Suche
 * @param teil - Teil mit Bezeichnung, optional Teilenummer und Fahrzeug-Info
 * @returns URL für PV Kompass Suchseite
 */
export function generatePvKompassLink(teil: {
  bezeichnung: string
  teilenummer?: string
  fahrzeug?: { marke?: string; modell?: string; fahrzeugtyp?: string }
}): string {
  const baseUrl = 'https://www.pvkompass.de/search'

  // Zusammensetzen der Suchbegriffe
  const suchBegriffe: string[] = []

  // Hauptbegriff: Teilbezeichnung
  if (teil.bezeichnung?.trim()) {
    suchBegriffe.push(teil.bezeichnung.trim())
  }

  // Optional: Teilenummer (OEM)
  if (teil.teilenummer?.trim()) {
    suchBegriffe.push(teil.teilenummer.trim())
  }

  // Fahrzeugtyp hat höchste Priorität für genaue Treffer
  if (teil.fahrzeug?.fahrzeugtyp?.trim()) {
    suchBegriffe.push(teil.fahrzeug.fahrzeugtyp.trim())
  }

  // Fallback: Fahrzeug-Info für bessere Ergebnisse
  if (teil.fahrzeug?.marke?.trim()) {
    suchBegriffe.push(teil.fahrzeug.marke.trim())
  }
  if (teil.fahrzeug?.modell?.trim()) {
    suchBegriffe.push(teil.fahrzeug.modell.trim())
  }

  // URL mit Suche zusammenstellen
  const query = suchBegriffe.join(' ')
  const urlParams = new URLSearchParams({ q: query })

  return `${baseUrl}?${urlParams.toString()}`
}
