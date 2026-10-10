// Erinnerungsprotokoll laden (siehe Tabelle kunden_erinnerungen): je Bezug (Rechnung/Fahrzeug) wie oft und zuletzt wann.
import type { SupabaseClient } from '@supabase/supabase-js'

export type ErinnerungsStand = Record<string, { anzahl: number; letzte: string; kanal: string }>

export async function ladeErinnerungen(
  supabase: SupabaseClient,
  betriebId: string,
  art: 'zahlung' | 'hu' | 'service',
): Promise<ErinnerungsStand> {
  const { data } = await supabase
    .from('kunden_erinnerungen')
    .select('bezug_id, kanal, erstellt_am')
    .eq('betrieb_id', betriebId)
    .eq('art', art)
    .order('erstellt_am', { ascending: true })
  const stand: ErinnerungsStand = {}
  for (const e of (data ?? []) as any[]) {
    stand[e.bezug_id] = { anzahl: (stand[e.bezug_id]?.anzahl ?? 0) + 1, letzte: e.erstellt_am, kanal: e.kanal }
  }
  return stand
}
