// Serverseitige Hilfen für die öffentliche Online-Terminbuchung (Ziel-Betrieb, Einstellungen, belegte Zeiten).
import { createAdminClient } from '@/lib/supabase/admin'
import { konfigAusEinstellungen, type Belegung, type BuchungKonfig } from '@/lib/buchung-slots'

// Ziel-Betrieb für öffentliche Online-Buchungen (Helios Automobile GmbH).
// Bevorzugt eine feste ID aus der Umgebungsvariable; fällt sonst auf Namenssuche
// zurück und, falls nur ein Betrieb existiert, auf diesen.
export async function getBuchungBetriebId(): Promise<string | null> {
  if (process.env.BOOKING_BETRIEB_ID) return process.env.BOOKING_BETRIEB_ID
  const supabase = createAdminClient()
  const { data: byName } = await supabase.from('betriebe').select('id').ilike('name', '%helios%').maybeSingle()
  if (byName?.id) return byName.id
  const { data: alle } = await supabase.from('betriebe').select('id')
  if (alle?.length === 1) return alle[0].id
  return null
}

export async function ladeBuchungKonfig(betriebId: string): Promise<BuchungKonfig> {
  const { data } = await createAdminClient()
    .from('betrieb_einstellungen')
    .select('schluessel, wert')
    .eq('betrieb_id', betriebId)
    .in('schluessel', ['buchung_beginn', 'buchung_ende', 'buchung_kapazitaet', 'buchung_geschlossen'])
  return konfigAusEinstellungen(Object.fromEntries((data ?? []).map(r => [r.schluessel, r.wert])))
}

/** Belegte Termine (ohne abgesagte) je Tag im Zeitraum von..bis (einschließlich) */
export async function ladeBelegungen(betriebId: string, von: string, bis: string): Promise<Record<string, (Belegung & { id: string; erstellt_am: string | null })[]>> {
  const { data } = await createAdminClient()
    .from('termine')
    .select('id, datum, uhrzeit, dauer_minuten, status, erstellt_am')
    .eq('betrieb_id', betriebId)
    .gte('datum', von)
    .lte('datum', bis)
  const nachTag: Record<string, (Belegung & { id: string; erstellt_am: string | null })[]> = {}
  for (const t of (data ?? []) as any[]) {
    if (t.status === 'abgesagt') continue
    ;(nachTag[t.datum] ??= []).push({ id: t.id, uhrzeit: t.uhrzeit, dauer_minuten: t.dauer_minuten, erstellt_am: t.erstellt_am ?? null })
  }
  return nachTag
}
