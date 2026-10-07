// Zugangsdaten eines Betriebs (API-Schlüssel, Passwörter, Secrets, Tokens) liegen in
// betrieb_einstellungen, sind aber für Nutzer-Sitzungen per RLS NICHT lesbar -- weder im Browser noch
// in Server-Routen mit Nutzer-Sitzung. Gelesen werden sie ausschließlich hier, serverseitig, mit dem
// Service-Role-Client. Wer diese Funktionen aufruft, MUSS vorher geprüft haben, dass der Nutzer zum
// Betrieb gehört, und darf die Werte nie an den Browser weiterreichen.
import { createAdminClient } from '@/lib/supabase/admin'

// Muss zur SQL-Funktion public.ist_geheimer_schluessel() passen
const GEHEIM = /(api_key|password|secret|token)/i

export function istGeheimerSchluessel(schluessel: string): boolean {
  return GEHEIM.test(schluessel)
}

// Entfernt Zugangsdaten aus einem Einstellungs-Objekt (z. B. bevor es an eine Seite/Komponente geht)
export function ohneGeheimnisse<T extends Record<string, unknown>>(einstellungen: T): Partial<T> {
  const sauber: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(einstellungen)) if (!istGeheimerSchluessel(k)) sauber[k] = v
  return sauber as Partial<T>
}

export async function ladeGeheimnisse(betriebId: string, schluessel: string[]): Promise<Record<string, string>> {
  const { data, error } = await createAdminClient()
    .from('betrieb_einstellungen').select('schluessel, wert')
    .eq('betrieb_id', betriebId).in('schluessel', schluessel)
  if (error) console.error('[Geheimnisse] Laden fehlgeschlagen:', error.message)
  const ergebnis: Record<string, string> = {}
  for (const r of data ?? []) if (r.wert) ergebnis[r.schluessel] = r.wert
  return ergebnis
}

export async function ladeGeheimnis(betriebId: string, schluessel: string): Promise<string | null> {
  return (await ladeGeheimnisse(betriebId, [schluessel]))[schluessel] ?? null
}

// Nur "ist gesetzt?" -- für Anzeigen wie "Postfach verbunden" / "Schlüssel gespeichert"
export async function hatGeheimnisse(betriebId: string, schluessel: string[]): Promise<Record<string, boolean>> {
  const werte = await ladeGeheimnisse(betriebId, schluessel)
  return Object.fromEntries(schluessel.map(k => [k, !!werte[k]]))
}
