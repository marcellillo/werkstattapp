import { SupabaseClient } from '@supabase/supabase-js'

export interface Betriebsstoff {
  id: string
  betrieb_id: string
  name: string
  einheit: string
  preis_pro_einheit: number
  einkaufspreis_pro_einheit: number | null
  aktiv: boolean
  sortierung: number
}

export interface BetriebsstoffMitBestand extends Betriebsstoff {
  zugang: number   // insgesamt eingelagert (Anfangsbestand + Zugänge, abzgl. Korrekturen)
  verkauft: number // auf nicht stornierten Rechnungen berechnet
  rest: number     // zugang - verkauft
}

export interface BetriebsstoffBewegung {
  id: string
  datum: string
  betriebsstoffId: string | null
  stoffName: string
  einheit: string
  menge: number // + Zugang, - Verkauf
  art: 'zugang' | 'verkauf'
  quelle: string
  storniert: boolean
  zugangId?: string
}

const num = (v: unknown) => Number(v ?? 0) || 0

export function formatMenge(menge: number, einheit = 'L') {
  return `${menge.toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${einheit}`
}

export function rundeBetrag(n: number) {
  return Math.round(n * 100) / 100
}

/**
 * Stoffarten eines Betriebs inkl. Bestand. Bestand = Summe der Zugänge minus alle auf
 * nicht stornierten Rechnungen verkauften Liter -- wird immer frisch berechnet, es gibt
 * keinen gespeicherten Saldo, der auseinanderlaufen könnte.
 */
export async function ladeBetriebsstoffeMitBestand(
  supabase: SupabaseClient,
  betriebId: string,
  opts: { nurAktive?: boolean } = {}
): Promise<BetriebsstoffMitBestand[]> {
  const [stoffe, zugaenge, verkaeufe] = await Promise.all([
    supabase.from('betriebsstoffe').select('*').eq('betrieb_id', betriebId).order('sortierung').order('name'),
    supabase.from('betriebsstoff_zugaenge').select('betriebsstoff_id, menge').eq('betrieb_id', betriebId),
    supabase
      .from('rechnung_betriebsstoffe')
      .select('betriebsstoff_id, menge, rechnung:kunden_rechnungen!inner(status)')
      .eq('betrieb_id', betriebId)
      .neq('rechnung.status', 'storniert'),
  ])

  for (const [name, res] of Object.entries({ stoffe, zugaenge, verkaeufe })) {
    if (res.error) console.error(`[Betriebsstoffe] Abfrage "${name}" fehlgeschlagen:`, res.error)
  }

  const zugangPro: Record<string, number> = {}
  for (const z of zugaenge.data ?? []) zugangPro[z.betriebsstoff_id] = (zugangPro[z.betriebsstoff_id] ?? 0) + num(z.menge)
  const verkauftPro: Record<string, number> = {}
  for (const v of verkaeufe.data ?? []) {
    if (v.betriebsstoff_id) verkauftPro[v.betriebsstoff_id] = (verkauftPro[v.betriebsstoff_id] ?? 0) + num(v.menge)
  }

  return (stoffe.data ?? [])
    .filter((s: any) => !opts.nurAktive || s.aktiv)
    .map((s: any) => {
      const zugang = rundeBetrag(zugangPro[s.id] ?? 0)
      const verkauft = rundeBetrag(verkauftPro[s.id] ?? 0)
      return {
        id: s.id,
        betrieb_id: s.betrieb_id,
        name: s.name,
        einheit: s.einheit,
        preis_pro_einheit: num(s.preis_pro_einheit),
        einkaufspreis_pro_einheit: s.einkaufspreis_pro_einheit == null ? null : num(s.einkaufspreis_pro_einheit),
        aktiv: s.aktiv,
        sortierung: s.sortierung,
        zugang,
        verkauft,
        rest: rundeBetrag(zugang - verkauft),
      }
    })
}

/** Letzte Bestandsbewegungen (Zugänge und Verkäufe auf Rechnungen) für den Verlauf. */
export async function ladeBewegungen(supabase: SupabaseClient, betriebId: string, limit = 40): Promise<BetriebsstoffBewegung[]> {
  const [zugaenge, verkaeufe, stoffe] = await Promise.all([
    supabase.from('betriebsstoff_zugaenge').select('id, betriebsstoff_id, menge, bemerkung, erstellt_am').eq('betrieb_id', betriebId).order('erstellt_am', { ascending: false }).limit(limit),
    supabase
      .from('rechnung_betriebsstoffe')
      .select('id, betriebsstoff_id, bezeichnung, einheit, menge, erstellt_am, rechnung:kunden_rechnungen!inner(rechnungs_nr, status)')
      .eq('betrieb_id', betriebId)
      .order('erstellt_am', { ascending: false })
      .limit(limit),
    supabase.from('betriebsstoffe').select('id, name, einheit').eq('betrieb_id', betriebId),
  ])
  for (const [name, res] of Object.entries({ zugaenge, verkaeufe, stoffe })) {
    if (res.error) console.error(`[Betriebsstoffe] Verlauf-Abfrage "${name}" fehlgeschlagen:`, res.error)
  }
  const stoffMap = Object.fromEntries((stoffe.data ?? []).map((s: any) => [s.id, s]))

  const liste: BetriebsstoffBewegung[] = [
    ...(zugaenge.data ?? []).map((z: any) => ({
      id: `z-${z.id}`,
      zugangId: z.id,
      datum: z.erstellt_am,
      betriebsstoffId: z.betriebsstoff_id,
      stoffName: stoffMap[z.betriebsstoff_id]?.name ?? 'Unbekannt',
      einheit: stoffMap[z.betriebsstoff_id]?.einheit ?? 'L',
      menge: num(z.menge),
      art: 'zugang' as const,
      quelle: z.bemerkung || (num(z.menge) < 0 ? 'Korrektur' : 'Zugang'),
      storniert: false,
    })),
    ...(verkaeufe.data ?? []).map((v: any) => ({
      id: `v-${v.id}`,
      datum: v.erstellt_am,
      betriebsstoffId: v.betriebsstoff_id,
      stoffName: v.bezeichnung,
      einheit: v.einheit,
      menge: -num(v.menge),
      art: 'verkauf' as const,
      quelle: `Rechnung ${v.rechnung?.rechnungs_nr ?? ''}`.trim(),
      storniert: v.rechnung?.status === 'storniert',
    })),
  ]
  return liste.sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, limit)
}
