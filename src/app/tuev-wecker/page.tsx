import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { TuevWeckerContent } from './tuev-wecker-content'

export default async function TuevWeckerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: fahrzeugeRaw } = await supabase
    .from('fahrzeuge')
    .select('id, kennzeichen, marke, modell, naechste_hauptuntersuchung, tuev_erinnerung, kunde_id, kunde:kunden(id, vorname, nachname, telefon, email)')
    .not('naechste_hauptuntersuchung', 'is', null)
    .neq('tuev_erinnerung', false)
    .order('naechste_hauptuntersuchung', { ascending: true })

  return (
    <AppLayout title="TÜV-Wecker">
      <TuevWeckerContent fahrzeuge={(fahrzeugeRaw ?? []) as any[]} />
    </AppLayout>
  )
}
