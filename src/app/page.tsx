import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/app-layout'
import { SalesDashboardContent } from './sales-dashboard-content'

export default async function Home() {
  try {
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

    // Monat start
    const monatStart = new Date()
    monatStart.setDate(1)
    monatStart.setHours(0, 0, 0, 0)
    const monatStartDate = monatStart.toISOString().split('T')[0]

    // KPIs für diesen Monat
    const [
      { data: fahrzeugeRaw },
      { data: verkauftRaw },
      { data: umsatzRaw },
    ] = await Promise.all([
      // Fahrzeuge im Bestand
      supabase
        .from('fahrzeuge')
        .select('id, auftraege(status)')
        .eq('betrieb_id', betriebId)
        .eq('fahrzeug_typ', 'eigen'),
      // Verkaufte Autos diesen Monat
      supabase
        .from('auftraege')
        .select('id, einnahmen, fahrzeug:fahrzeuge(id, einkaufspreis, verkaufspreis)')
        .eq('betrieb_id', betriebId)
        .eq('status', 'verkauft')
        .gte('verkauft_am', monatStartDate),
      // Für Chart: Umsatz nach Woche
      supabase
        .from('auftraege')
        .select('verkauft_am, einnahmen')
        .eq('betrieb_id', betriebId)
        .eq('status', 'verkauft')
        .gte('verkauft_am', monatStartDate),
    ])

    // Filter: Nur Fahrzeuge im Bestand (nicht verkauft, ausgeliefert, storniert)
    const bestandCount = (fahrzeugeRaw ?? []).filter((f: any) => {
      const status = f.auftraege?.[0]?.status
      return status && !['verkauft', 'ausgeliefert', 'storniert'].includes(status)
    }).length

    return (
      <AppLayout title="Sales Dashboard">
        <SalesDashboardContent
          bestand={bestandCount}
          verkauft={verkauftRaw ?? []}
          umsatzData={umsatzRaw ?? []}
        />
      </AppLayout>
    )
  } catch (error) {
    console.error('[Home] Fatal error:', error)
    return (
      <AppLayout title="Sales Dashboard">
        <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
          <h1 className="text-2xl font-bold text-red-900">Fehler beim Laden</h1>
          <p className="text-red-700 mt-2">{String(error)}</p>
        </div>
      </AppLayout>
    )
  }
}
