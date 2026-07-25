import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { StatistikenContent } from './statistiken-content'

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

  // Lade alle Daten parallel
  const [
    { data: verkauftRaw },
    { data: werkstattRaw },
    { data: lagerRaw },
  ] = await Promise.all([
    // Verkäufe (Eigenfahrzeuge)
    supabase
      .from('auftraege')
      .select('id, einnahmen, verkauft_am, fahrzeug:fahrzeuge(id, marke, modell, einkaufspreis, verkaufspreis)')
      .eq('betrieb_id', betriebId)
      .eq('status', 'verkauft')
      .order('verkauft_am', { ascending: false }),
    // Werkstatt-Aufträge (fremde Fahrzeuge)
    supabase
      .from('auftraege')
      .select('id, einnahmen, fertiggestellt_am, ersatzteile(kosten)')
      .eq('betrieb_id', betriebId)
      .eq('status', 'fertig')
      .not('fahrzeug', 'is', null)
      .order('fertiggestellt_am', { ascending: false }),
    // Lager-Fahrzeuge (im Bestand)
    supabase
      .from('fahrzeuge')
      .select('id, marke, modell, einkaufspreis, kennzeichen')
      .eq('betrieb_id', betriebId)
      .eq('fahrzeug_typ', 'eigen')
      .eq('status', 'angenommen'),
  ])

  // Berechne Ersatzteile-Kosten für Werkstatt
  const werkstattWithKosten = (werkstattRaw ?? []).map((w: any) => ({
    ...w,
    ersatzteile_kosten: (w.ersatzteile ?? []).reduce((sum: number, e: any) => sum + (e.kosten || 0), 0),
  }))

  return (
    <AppLayout title="Statistiken">
      <StatistikenContent
        verkauft={verkauftRaw ?? []}
        werkstatt={werkstattWithKosten}
        lager={lagerRaw ?? []}
      />
    </AppLayout>
  )
}
