// @ts-nocheck
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { VorlagenContent } from './vorlagen-content'

export default async function VorlagenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: templates } = await supabase
    .from('workflow_templates')
    .select('*, steps:workflow_template_steps(*)')
    .order('name')
  return (
    <AppLayout title="Workflow-Vorlagen">
      <VorlagenContent templates={templates ?? []} currentUserId={user.id} />
    </AppLayout>
  )
}
