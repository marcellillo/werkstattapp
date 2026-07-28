import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { MitarbeiterContent } from './mitarbeiter-content'

export default async function MitarbeiterPage() {
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

  // Check if admin or superadmin
  const { data: userRole } = await supabase
    .from('betrieb_users')
    .select('role')
    .eq('betrieb_id', betriebId)
    .eq('profile_id', user.id)
    .single()

  if (userRole?.role !== 'admin' && userRole?.role !== 'superadmin') {
    redirect('/dashboard')
  }

  // Get all users in betrieb
  const { data: betriebUsers } = await supabase
    .from('betrieb_users')
    .select('id, profile_id, role, profiles(full_name, email)')
    .eq('betrieb_id', betriebId)

  // Get pending invitations
  const { data: invitations } = await supabase
    .from('user_invitations')
    .select('*')
    .eq('betrieb_id', betriebId)
    .order('erstellt_am', { ascending: false })

  return (
    <AppLayout title="Mitarbeiter">
      <MitarbeiterContent
        betriebId={betriebId}
        users={betriebUsers ?? []}
        invitations={invitations ?? []}
      />
    </AppLayout>
  )
}
