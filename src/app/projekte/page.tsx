// @ts-nocheck
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { ProjecteContent } from './projekte-content'

export default async function ProjektePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: projects } = await supabase
    .from('projects')
    .select('*, customer:customers(*), steps:project_steps(*)')
    .order('created_at', { ascending: false })

  return (
    <AppLayout title="Projekte">
      <ProjecteContent projects={projects ?? []} />
    </AppLayout>
  )
}
