import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { StatistikenContent } from './statistiken-content'

export default async function StatistikenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: auftraegeRaw },
    { data: teileRaw },
    { data: rechnungenRaw },
    { data: hebebuehnenRaw },
  ] = await Promise.all([
    supabase
      .from('auftraege')
      .select('id, status, erstellt_am, fertiggestellt_am, verkauft_am, einnahmen, steuerart, tuev_kandidat, tuev_ergebnis, hebebuehne_id, fahrzeug:fahrzeuge(marke, modell, kennzeichen, fahrzeug_typ, einkaufspreis)')
      .order('erstellt_am'),
    supabase
      .from('ersatzteile')
      .select('id, status, lieferant, einzelpreis, menge, bestellt_am, geliefert_am'),
    supabase
      .from('rechnungen')
      .select('id, lieferant, gesamt, datum, quelle')
      .order('datum'),
    supabase
      .from('hebebuehnen')
      .select('id, nummer, bezeichnung'),
  ])

  return (
    <AppLayout title="Statistiken">
      <StatistikenContent
        auftraege={auftraegeRaw ?? []}
        teile={teileRaw ?? []}
        rechnungen={rechnungenRaw ?? []}
        hebebuehnen={hebebuehnenRaw ?? []}
      />
    </AppLayout>
  )
}
