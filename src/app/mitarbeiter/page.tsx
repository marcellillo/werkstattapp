import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { MitarbeiterContent } from './mitarbeiter-content'

export default async function MitarbeiterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[Mitarbeiter] User:', user?.id)
  if (!user) redirect('/login')

  // Get user's betrieb
  const { data: userBetriebe } = await supabase
    .from('betrieb_users')
    .select('betrieb_id')
    .eq('profile_id', user.id)
    .order('is_primary', { ascending: false })
    .limit(1)

  console.log('[Mitarbeiter] UserBetriebe:', userBetriebe)
  if (!userBetriebe?.[0]?.betrieb_id) redirect('/login')
  const betriebId = userBetriebe[0].betrieb_id

  // Check if admin or superadmin in ANY betrieb
  const { data: allUserRoles } = await supabase
    .from('betrieb_users')
    .select('role')
    .eq('profile_id', user.id)

  console.log('[Mitarbeiter] AllUserRoles:', allUserRoles)
  const isAuthorized = allUserRoles?.some(r => r.role === 'admin' || r.role === 'superadmin')
  if (!isAuthorized) {
    console.log('[Mitarbeiter] NOT AUTHORIZED - Redirecting to dashboard')
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
