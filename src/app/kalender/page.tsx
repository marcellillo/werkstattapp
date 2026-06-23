import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { KalenderContent } from './kalender-content'

export default async function KalenderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: auftraegeRaw } = await supabase
    .from('auftraege')
    .select(`
      id, auftrag_nr, status, geplante_fertigstellung, arbeiten,
      fahrzeug:fahrzeuge(marke, modell, kennzeichen),
      kunde:kunden(vorname, nachname),
      hebebuehne:hebebuehnen(bezeichnung)
    `)
    .not('status', 'eq', 'ausgeliefert')
    .not('geplante_fertigstellung', 'is', null)
    .order('geplante_fertigstellung')

  return (
    <AppLayout title="Kalender">
      <KalenderContent auftraege={(auftraegeRaw ?? []) as any[]} />
    </AppLayout>
  )
}
