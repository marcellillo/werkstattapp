import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { TeileContent } from './teile-content'

export default async function TeilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teileRaw } = await supabase
    .from('ersatzteile')
    .select(`
      *,
      auftrag:auftraege(
        id, auftrag_nr, status,
        fahrzeug:fahrzeuge(marke, modell, kennzeichen),
        kunde:kunden(vorname, nachname)
      )
    `)
    .order('erstellt_am', { ascending: false })

  return (
    <AppLayout title="Ersatzteile">
      <TeileContent teile={(teileRaw ?? []) as any[]} />
    </AppLayout>
  )
}
