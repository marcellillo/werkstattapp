import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { KundenContent } from './kunden-content'

export default async function KundenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: kunden } = await supabase
    .from('kunden')
    .select('*')
    .order('nachname')

  const { data: kundenMitAuftraegen } = await supabase
    .from('kunden')
    .select(`
      *,
      fahrzeuge(
        id, marke, modell, kennzeichen, baujahr,
        auftraege(
          id, auftrag_nr, status, arbeiten, erstellt_am,
          geplante_fertigstellung, einnahmen
        )
      )
    `)
    .order('nachname')

  return (
    <AppLayout title="Kunden">
      <KundenContent
        kunden={(kunden ?? []) as any[]}
        kundenMitAuftraegen={(kundenMitAuftraegen ?? []) as any[]}
      />
    </AppLayout>
  )
}
