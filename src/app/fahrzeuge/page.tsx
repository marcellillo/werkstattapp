import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { FahrzeugeContent } from './fahrzeuge-content'

export default async function FahrzeugePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: auftraegeRaw }, { data: hebebuehnenRaw }] = await Promise.all([
    supabase
      .from('auftraege')
      .select(`*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)`)
      .neq('status', 'storniert')
      .order('erstellt_am', { ascending: false }),
    supabase.from('hebebuehnen').select('*').order('nummer'),
  ])

  const hebebuehnen = (hebebuehnenRaw ?? []) as any[]
  const auftraege = (auftraegeRaw ?? []).map((a: any) => ({
    ...a,
    hebebuehne: hebebuehnen.find(h => h.id === a.hebebuehne_id) ?? null,
  })) as any[]

  return (
    <AppLayout title="Fahrzeuge">
      <FahrzeugeContent auftraege={auftraege} />
    </AppLayout>
  )
}
