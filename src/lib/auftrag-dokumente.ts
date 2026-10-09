// Gemeinsame Definitionen für Dokumente & Dateien je Auftrag (Client + Server).

export const DOKUMENT_BUCKET = 'auftrag-dokumente'
export const DOKUMENT_MAX_BYTES = 25 * 1024 * 1024
/** Privater Bucket für die erzeugte Komplett-PDF der Auftragsmappe (nur Server-Zugriff). */
export const MAPPEN_BUCKET = 'auftrag-mappen'

export const DOKUMENT_KATEGORIEN = [
  { value: 'carvertical',    label: 'CarVertical / Fahrzeughistorie', kurz: 'CarVertical' },
  { value: 'fahrzeugschein', label: 'Fahrzeugschein',                 kurz: 'Fahrzeugschein' },
  { value: 'fahrzeugbrief',  label: 'Fahrzeugbrief',                  kurz: 'Fahrzeugbrief' },
  { value: 'tuev',           label: 'TÜV-Bericht',                    kurz: 'TÜV' },
  { value: 'gutachten',      label: 'Gutachten',                      kurz: 'Gutachten' },
  { value: 'vertrag',        label: 'Kaufvertrag / Vertrag',          kurz: 'Vertrag' },
  { value: 'rechnung',       label: 'Rechnung / Beleg',               kurz: 'Beleg' },
  { value: 'sonstiges',      label: 'Sonstiges',                      kurz: 'Sonstiges' },
] as const

export type DokumentKategorie = typeof DOKUMENT_KATEGORIEN[number]['value']

export interface AuftragDokument {
  id: string
  auftrag_id: string
  kategorie: DokumentKategorie
  titel: string | null
  datei_name: string
  datei_typ: string
  groesse: number | null
  erstellt_am: string
}

export function istKategorie(v: unknown): v is DokumentKategorie {
  return DOKUMENT_KATEGORIEN.some(k => k.value === v)
}

export function kategorieLabel(v: string): string {
  return DOKUMENT_KATEGORIEN.find(k => k.value === v)?.label ?? 'Sonstiges'
}

// Erlaubte Dateitypen: PDF und gängige Bildformate (alles andere kann die App nicht anzeigen/drucken)
export function erlaubterTyp(name: string, contentType?: string | null): 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | null {
  const ct = (contentType ?? '').toLowerCase()
  const n = (name ?? '').toLowerCase()
  if (ct === 'application/pdf' || n.endsWith('.pdf')) return 'application/pdf'
  if (ct === 'image/jpeg' || ct === 'image/jpg' || /\.jpe?g$/.test(n)) return 'image/jpeg'
  if (ct === 'image/png' || n.endsWith('.png')) return 'image/png'
  if (ct === 'image/webp' || n.endsWith('.webp')) return 'image/webp'
  if (ct === 'image/gif' || n.endsWith('.gif')) return 'image/gif'
  return null
}

// Kategorie aus dem Dateinamen erraten (der Nutzer kann sie danach ändern)
export function rateKategorie(dateiname: string): DokumentKategorie {
  const n = dateiname.toLowerCase()
  if (/carvertical|car-vertical|vehicle[-_ ]?history|fahrzeughistorie/.test(n)) return 'carvertical'
  if (/t(ü|u|ue)v|hauptuntersuchung|pr(ü|u|ue)fbericht/.test(n)) return 'tuev'
  if (/gutachten|sch(ä|a|ae)tzung/.test(n)) return 'gutachten'
  if (/fahrzeugbrief|zulassungsbescheinigung[-_ ]?(teil[-_ ]?)?(ii|2)/.test(n)) return 'fahrzeugbrief'
  if (/fahrzeugschein|zulassungsbescheinigung/.test(n)) return 'fahrzeugschein'
  if (/kaufvertrag|vertrag/.test(n)) return 'vertrag'
  if (/rechnung|invoice|beleg|quittung/.test(n)) return 'rechnung'
  return 'sonstiges'
}

export function bereinigeDokumentName(name: string): string {
  const punkt = name.lastIndexOf('.')
  const stamm = punkt > 0 ? name.slice(0, punkt) : name
  const endung = punkt > 0 ? name.slice(punkt + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) : ''
  const sauber = stamm
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'datei'
  return endung ? `${sauber}.${endung}` : sauber
}

export function formatGroesse(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`
}
