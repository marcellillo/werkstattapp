import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MitarbeiterContent } from './mitarbeiter-content'

export default async function MitarbeiterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Ein Query statt zwei: liefert sowohl den (primären) Betrieb als auch alle
  // Rollen des Nutzers über alle Betriebe hinweg.
  const { data: userBetriebe } = await supabase
    .from('betrieb_users')
    .select('betrieb_id, role')
    .eq('profile_id', user.id)
    .order('is_primary', { ascending: false })

  if (!userBetriebe?.[0]?.betrieb_id) redirect('/login')
  const betriebId = userBetriebe[0].betrieb_id

  // Check if admin or superadmin in ANY betrieb
  const isAuthorized = userBetriebe.some(r => r.role === 'admin' || r.role === 'superadmin')
  if (!isAuthorized) redirect('/dashboard')

  // Team-Mitglieder und ausstehende Einladungen sind unabhängig voneinander -> parallel laden
  const [{ data: betriebUsers }, { data: invitations }] = await Promise.all([
    supabase
      .from('betrieb_users')
      .select('id, profile_id, role, profiles(full_name, email)')
      .eq('betrieb_id', betriebId),
    supabase
      .from('user_invitations')
      .select('*')
      .eq('betrieb_id', betriebId)
      .order('erstellt_am', { ascending: false }),
  ])

  return (
    <MitarbeiterContent
      betriebId={betriebId}
      users={(betriebUsers ?? []) as any}
      invitations={invitations ?? []}
    />
  )
}
