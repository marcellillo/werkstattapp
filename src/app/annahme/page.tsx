import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { AnnahmeUebersicht } from './annahme-uebersicht'
import { getBetriebIdForUser } from '@/lib/server-betrieb'

export default async function AnnahmePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const { data: auftraege } = await supabase
    .from('auftraege')
    .select(`
      id, auftrag_nr, status, erstellt_am, arbeiten,
      annahme_datum, kostenrahmen_max, annahme_km,
      fahrzeug:fahrzeuge(marke, modell, kennzeichen),
      kunde:kunden(vorname, nachname, firma)
    `)
    .eq('betrieb_id', betriebId)
    .not('status', 'in', '(ausgeliefert,storniert)')
    .order('erstellt_am', { ascending: false })
    .limit(100)

  return (
    <AppLayout title="Annahme">
      <AnnahmeUebersicht auftraege={(auftraege ?? []) as any[]} />
    </AppLayout>
  )
}
