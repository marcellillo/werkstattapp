// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { NewProjectForm } from './new-project-form'

export default async function NewProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: customers },
    { data: templates },
  ] = await Promise.all([
    supabase.from('customers').select('*').order('last_name'),
    supabase.from('workflow_templates').select('*, steps:workflow_template_steps(*)').order('name'),
  ])

  return (
    <AppLayout title="Neues Projekt">
      <NewProjectForm customers={customers ?? []} templates={templates ?? []} />
    </AppLayout>
  )
}

