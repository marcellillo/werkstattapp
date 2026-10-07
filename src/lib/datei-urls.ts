// Adressen für Fotos und Lieferanten-Belege. Die Speicher-Buckets sind PRIVAT: Dateien werden nur über
// diese Routen ausgeliefert (Anmeldung + Betriebszugehörigkeit geprüft, dann Weiterleitung auf einen
// kurzlebigen signierten Link). Die in der Datenbank gespeicherten "öffentlichen" URLs sind nicht mehr abrufbar.

export const fotoUrl = (id: string) => `/api/auftrag-foto/datei?id=${id}`

export type BelegTyp = 'lieferschein' | 'lieferant'
export const belegUrl = (typ: BelegTyp, id: string) => `/api/beleg/datei?typ=${typ}&id=${id}`

export const BELEG_BUCKETS = ['supplier-invoice', 'supplier-invoices'] as const

// Aus einer gespeicherten Storage-URL (…/storage/v1/object/public/<bucket>/<pfad>) Bucket und Pfad lesen
export function speicherOrt(url: string | null | undefined): { bucket: string; pfad: string } | null {
  if (!url) return null
  const m = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/.exec(url)
  if (!m) return null
  let pfad: string
  try { pfad = decodeURIComponent(m[2]) } catch { return null }
  if (pfad.includes('..') || pfad.startsWith('/')) return null
  return { bucket: m[1], pfad }
}
