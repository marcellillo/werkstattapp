import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { NeuFahrzeugForm } from './neu-fahrzeug-form'

export default async function NeuFahrzeugPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's betrieb
  const { data: userBetriebe } = await supabase
    .from('betrieb_users')
    .select('betrieb_id')
    .eq('profile_id', user.id)
    .order('is_primary', { ascending: false })
    .limit(1)

  if (!userBetriebe?.[0]?.betrieb_id) redirect('/login')
  const betriebId = userBetriebe[0].betrieb_id

  const [{ data: kunden }, { data: hebebuehnen }] = await Promise.all([
    supabase.from('kunden').select('*').eq('betrieb_id', betriebId).order('nachname'),
    supabase.from('hebebuehnen').select('*').order('nummer'),
  ])

  return (
    <AppLayout title="Neues Fahrzeug">
      <NeuFahrzeugForm
        kunden={(kunden ?? []) as any[]}
        hebebuehnen={(hebebuehnen ?? []) as any[]}
      />
    </AppLayout>
  )
}
