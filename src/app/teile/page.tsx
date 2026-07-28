import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { TeileContent } from './teile-content'
import { getBetriebIdForUser } from '@/lib/server-betrieb'

export default async function TeilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const [{ data: teileRaw }, { data: lagerRaw }] = await Promise.all([
    supabase
      .from('ersatzteile')
      .select(`
        *,
        auftrag:auftraege(
          id, auftrag_nr, status,
          fahrzeug:fahrzeuge(marke, modell, kennzeichen),
          kunde:kunden(vorname, nachname)
        )
      `)
      .eq('betrieb_id', betriebId)
      .order('erstellt_am', { ascending: false }),
    supabase
      .from('lager_artikel')
      .select('*')
      .eq('betrieb_id', betriebId)
      .order('bezeichnung'),
  ])

  return (
    <AppLayout title="Lager">
      <TeileContent
        teile={(teileRaw ?? []) as any[]}
        lagerArtikel={(lagerRaw ?? []) as any[]}
      />
    </AppLayout>
  )
}
