export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { HebebuehnenContent } from './hebebuehnen-content'

export default async function HebebuehnenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: hebebuehnen }, { data: termine }, { data: auftraege }] = await Promise.all([
    supabase.from('hebebuehnen').select('*').order('position'),
    supabase
      .from('termine')
      .select('id, titel, datum, uhrzeit, dauer_minuten, typ, status, hebebuehne_id, fahrzeug:fahrzeuge(kennzeichen, marke, modell), kunde:kunden(vorname, nachname)')
      .not('hebebuehne_id', 'is', null)
      .gte('datum', today)
      .neq('status', 'abgesagt')
      .order('datum')
      .order('uhrzeit'),
    supabase
      .from('auftraege')
      .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(vorname, nachname, firma), ersatzteile(*)')
      .not('hebebuehne_id', 'is', null)
      .not('status', 'in', '("fertig","ausgeliefert","storniert")'),
  ])

  return (
    <AppLayout title="Hebebühnen verwalten">
      <HebebuehnenContent
        hebebuehnen={(hebebuehnen ?? []) as any[]}
        termine={(termine ?? []) as any[]}
        auftraege={(auftraege ?? []) as any[]}
      />
    </AppLayout>
  )
}
