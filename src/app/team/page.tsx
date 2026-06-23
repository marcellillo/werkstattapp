// @ts-nocheck
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { TeamContent } from './team-content'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profiles } = await supabase.from('profiles').select('*').order('full_name')
  const { data: currentProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return (
    <AppLayout title="Team">
      <TeamContent profiles={profiles ?? []} currentProfile={currentProfile} />
    </AppLayout>
  )
}
