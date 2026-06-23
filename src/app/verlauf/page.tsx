export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { VerlaufContent } from './verlauf-content'

export default async function VerlaufPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: auftraege } = await supabase
    .from('auftraege')
    .select(`
      id, created_at, status, arbeiten, tuev_ergebnis, tuev_kandidat,
      fahrzeug:fahrzeuge(id, kennzeichen, marke, modell, baujahr, fahrzeug_typ),
      kunde:kunden(id, vorname, nachname, telefon, firma),
      ersatzteile(id, bezeichnung, teilenummer, preis, status, menge)
    `)
    .eq('status', 'ausgeliefert')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <AppLayout title="Verlauf">
      <VerlaufContent auftraege={(auftraege ?? []) as any[]} />
    </AppLayout>
  )
}
