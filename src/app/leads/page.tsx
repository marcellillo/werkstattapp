// @ts-nocheck
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { LeadsContent } from './leads-content'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [{ data: leads }, { data: customers }, { data: profiles }] = await Promise.all([
    supabase.from('leads').select('*, customer:customers(*), assigned_profile:profiles(*)').order('created_at', { ascending: false }),
    supabase.from('customers').select('*').order('last_name'),
    supabase.from('profiles').select('*').order('full_name'),
  ])
  return (
    <AppLayout title="Leads">
      <LeadsContent leads={leads ?? []} customers={customers ?? []} profiles={profiles ?? []} currentUserId={user.id} />
    </AppLayout>
  )
}
