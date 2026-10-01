import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Hält auftraege.einnahmen synchron mit der Summe aller aktiven (nicht
 * stornierten) Rechnungen dieses Auftrags. Statistiken, Buchhaltung und
 * Dashboard lesen ausschließlich einnahmen -- ohne diesen Sync blieb der
 * Wert nach dem Umstieg auf den eigenständigen Rechnungs-Flow (kunden_rechnungen)
 * dauerhaft leer, obwohl echte Rechnungen existierten.
 */
export async function syncAuftragEinnahmen(
  supabase: SupabaseClient,
  auftragId: string | null | undefined,
  betriebId: string
) {
  if (!auftragId) return

  const { data: rechnungen } = await supabase
    .from('kunden_rechnungen')
    .select('betrag_brutto')
    .eq('auftrag_id', auftragId)
    .eq('betrieb_id', betriebId)
    .neq('status', 'storniert')

  const summe = (rechnungen ?? []).reduce((s, r: any) => s + (r.betrag_brutto || 0), 0)

  await supabase
    .from('auftraege')
    .update({ einnahmen: summe > 0 ? summe : null })
    .eq('id', auftragId)
    .eq('betrieb_id', betriebId)
}
