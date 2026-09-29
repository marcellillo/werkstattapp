/**
 * Wandelt eine Adresse in Koordinaten um, über die kostenlose Nominatim-API
 * (OpenStreetMap) -- kein API-Key nötig. Nutzungsrichtlinie beachten: maximal
 * 1 Anfrage/Sekunde, daher beim Geokodieren mehrerer Adressen nacheinander
 * mit Verzögerung aufrufen (siehe geocodeSequenziell).
 */
export interface Koordinaten {
  lat: number
  lng: number
}

export async function geocodeAdresse(strasse?: string | null, plz?: string | null, ort?: string | null): Promise<Koordinaten | null> {
  const teile = [strasse, plz, ort].filter(Boolean)
  if (teile.length === 0) return null

  const query = [...teile, 'Deutschland'].join(', ')
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`

  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'de' },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const lat = parseFloat(data[0].lat)
    const lng = parseFloat(data[0].lon)
    if (isNaN(lat) || isNaN(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}

function warten(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Geokodiert mehrere Adressen nacheinander mit 1,1s Pause (Nominatim-Limit:
 * max. 1 Anfrage/Sekunde). Ruft nach jedem Ergebnis onResult auf, damit der
 * Aufrufer sofort speichern/anzeigen kann statt auf alles zu warten.
 */
export async function geocodeSequenziell<T>(
  items: T[],
  getAdresse: (item: T) => { strasse?: string | null; plz?: string | null; ort?: string | null },
  onResult: (item: T, koordinaten: Koordinaten | null) => void
) {
  for (const item of items) {
    const { strasse, plz, ort } = getAdresse(item)
    const koordinaten = await geocodeAdresse(strasse, plz, ort)
    onResult(item, koordinaten)
    await warten(1100)
  }
}
