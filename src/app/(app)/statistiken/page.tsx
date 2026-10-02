import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatistikenContent } from './statistiken-content'
import { ERSATZTEIL_AUFSCHLAG } from '@/lib/ersatzteil-aufschlag'

// Materialkosten (Einkauf) der Teile, die auf einer Rechnung abgerechnet wurden.
// - Position mit gespeichertem Einkaufspreis (aus gescanntem Lieferschein): echter EK.
// - Position ohne EK (Altdaten / manuell erfasst): Schätzung = Verkaufspreis ÷ Aufschlagsfaktor,
//   weil der Verkaufspreis aus dem EK per mitAufschlag() entstanden ist.
// - Kostenvoranschlag im Festpreis-Modus ohne erfasste Einzelteile: Festpreis ÷ Aufschlagsfaktor.
function materialKosten(kostenvoranschlaege: any[]) {
  let beleg = 0
  let geschaetzt = 0
  for (const kv of kostenvoranschlaege) {
    const positionen: any[] = kv.kostenvoranschlag_position ?? []
    if (positionen.length === 0) {
      if (kv.ersatzteile_modus === 'festpreis') {
        geschaetzt += (kv.ersatzteile_festpreis || 0) / ERSATZTEIL_AUFSCHLAG
      }
      continue
    }
    for (const p of positionen) {
      const menge = p.menge || 1
      if (p.einkaufspreis != null) {
        beleg += p.einkaufspreis * menge
      } else {
        geschaetzt += (p.gesamtpreis ?? (p.einzelpreis || 0) * menge) / ERSATZTEIL_AUFSCHLAG
      }
    }
  }
  return { beleg, geschaetzt }
}

export default async function StatistikenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's betrieb
  const { data: userBetriebe } = await supabase
    .from('betrieb_users')
    .select('betrieb_id')
    .eq('profile_id', user.id)
    .order('is_primary', { ascending: false })
    .limit(1)

  if (!userBetriebe?.[0]?.betrieb_id) redirect('/login')
  const betriebId = userBetriebe[0].betrieb_id

  const [verkauft, rechnungen, kostenvoranschlaege, lager] = await Promise.all([
    // Verkäufe (Eigenfahrzeuge). Verkaufte Autos wechseln nach der Übergabe auf
    // 'ausgeliefert' und müssen weiterhin zählen.
    supabase
      .from('auftraege')
      .select('id, einnahmen, verkauft_am, fahrzeug:fahrzeuge!inner(id, marke, modell, einkaufspreis, verkaufspreis, fahrzeug_typ)')
      .eq('betrieb_id', betriebId)
      .in('status', ['verkauft', 'ausgeliefert'])
      .eq('fahrzeug.fahrzeug_typ', 'eigen')
      .not('verkauft_am', 'is', null)
      .order('verkauft_am', { ascending: false }),
    // Werkstatt: alle ausgestellten, nicht stornierten Rechnungen
    supabase
      .from('kunden_rechnungen')
      .select('id, betrag_netto, erstellt_am')
      .eq('betrieb_id', betriebId)
      .neq('status', 'storniert')
      .order('erstellt_am', { ascending: false }),
    // Kostenvoranschläge, die einer Rechnung zugeordnet sind (Material der Rechnung)
    supabase
      .from('kostenvoranschlaege')
      .select('rechnung_id, ersatzteile_modus, ersatzteile_festpreis, kostenvoranschlag_position(einkaufspreis, einzelpreis, gesamtpreis, menge)')
      .eq('betrieb_id', betriebId)
      .not('rechnung_id', 'is', null),
    // Lager: Eigenfahrzeuge im Bestand (keine Kundenfahrzeuge in der Werkstatt)
    supabase
      .from('auftraege')
      .select('fahrzeug:fahrzeuge!inner(id, marke, modell, einkaufspreis, kennzeichen, fahrzeug_typ)')
      .eq('betrieb_id', betriebId)
      .neq('status', 'ausgeliefert')
      .neq('status', 'storniert')
      .neq('status', 'verkauft')
      .eq('fahrzeug.fahrzeug_typ', 'eigen'),
  ])

  // Abfragefehler dürfen nicht stillschweigend zu "0 €" werden
  for (const [name, res] of Object.entries({ verkauft, rechnungen, kostenvoranschlaege, lager })) {
    if (res.error) console.error(`[Statistiken] Abfrage "${name}" fehlgeschlagen:`, res.error)
  }

  const kvProRechnung: Record<string, any[]> = {}
  for (const kv of kostenvoranschlaege.data ?? []) {
    ;(kvProRechnung[kv.rechnung_id] ||= []).push(kv)
  }

  const werkstatt = (rechnungen.data ?? []).map((r: any) => {
    const { beleg, geschaetzt } = materialKosten(kvProRechnung[r.id] ?? [])
    return {
      id: r.id,
      datum: r.erstellt_am,
      einnahmen: r.betrag_netto || 0,
      ersatzteile_kosten: beleg + geschaetzt,
      kosten_geschaetzt: geschaetzt,
    }
  })

  return (
    <StatistikenContent
      verkauft={verkauft.data ?? []}
      werkstatt={werkstatt}
      lager={lager.data ?? []}
    />
  )
}
