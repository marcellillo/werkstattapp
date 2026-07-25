import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { EinstellungenContent } from './einstellungen-content'

export default async function EinstellungenPage() {
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

  // Load betrieb data
  const { data: betrieb } = await supabase
    .from('betriebe')
    .select('*')
    .eq('id', betriebId)
    .single()

  return (
    <AppLayout title="Einstellungen">
      <EinstellungenContent betrieb={betrieb} />
    </AppLayout>
  )
}
