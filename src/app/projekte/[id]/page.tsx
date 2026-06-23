// @ts-nocheck
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { ProjectDetail } from './project-detail'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: project },
    { data: updates },
    { data: team },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('*, customer:customers(*), steps:project_steps(*, assigned_profile:profiles(*))')
      .eq('id', id)
      .single(),
    supabase
      .from('project_updates')
      .select('*, author:profiles(*), attachments:project_attachments(*)')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('project_team_members')
      .select('*, profile:profiles(*)')
      .eq('project_id', id),
  ])

  if (!project) notFound()

  const sortedSteps = (project.steps ?? []).sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)

  return (
    <AppLayout title={`${project.project_number} – ${project.title}`}>
      <ProjectDetail
        project={{ ...project, steps: sortedSteps }}
        updates={updates ?? []}
        team={team ?? []}
        currentUserId={user.id}
      />
    </AppLayout>
  )
}
