import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { NeuFahrzeugForm } from './neu-fahrzeug-form'

export default async function NeuFahrzeugPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: kunden }, { data: hebebuehnen }] = await Promise.all([
    supabase.from('kunden').select('*').order('nachname'),
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
