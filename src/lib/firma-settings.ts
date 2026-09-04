import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lädt die Firmendaten (Key-Value-Tabelle, gepflegt über die Einstellungsseite) für einen Betrieb.
 * Fällt für "firma_name" auf den registrierten Betriebsnamen (betriebe.name) zurück, falls in
 * den Einstellungen noch kein eigener Firmenname für Dokumente hinterlegt wurde.
 */
export async function resolveFirmaSettings(supabase: SupabaseClient, betriebId: string): Promise<Record<string, string>> {
  const { data: settingsRows } = await supabase
    .from('betrieb_einstellungen')
    .select('schluessel, wert')
    .eq('betrieb_id', betriebId)

  const firma: Record<string, string> = {}
  for (const row of settingsRows || []) {
    if (row.wert !== null) firma[row.schluessel] = row.wert
  }

  if (!firma.firma_name) {
    const { data: betrieb } = await supabase
      .from('betriebe')
      .select('name')
      .eq('id', betriebId)
      .maybeSingle()
    if (betrieb?.name) firma.firma_name = betrieb.name
  }

  return firma
}
