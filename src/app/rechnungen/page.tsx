import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/app-layout'
import { RechnungenContent } from './rechnungen-content'

export default async function RechnungenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userBetriebe } = await supabase
    .from('betrieb_users')
    .select('betrieb_id, role')
    .eq('profile_id', user.id)
    .order('is_primary', { ascending: false })
    .limit(1)

  if (!userBetriebe?.[0]?.betrieb_id) redirect('/login')
  const betriebId = userBetriebe[0].betrieb_id
  const isAdmin = userBetriebe[0].role === 'admin'

  const { data: rechnungen } = await supabase
    .from('rechnungen')
    .select('*, positionen:rechnung_positionen(*)')
    .eq('betrieb_id', betriebId)
    .order('erstellt_am', { ascending: false })

  return (
    <AppLayout title="Rechnungen">
      <RechnungenContent rechnungen={(rechnungen ?? []) as any[]} isAdmin={isAdmin} />
    </AppLayout>
  )
}
