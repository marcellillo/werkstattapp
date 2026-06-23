// @ts-nocheck
'use client'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  MapPin, Calendar, Euro, User, Users, MessageSquare, Paperclip,
  CheckCircle2, Circle, AlertCircle, Clock, ChevronDown, ChevronRight, Send
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { Project, ProjectStep, ProjectUpdate, ProjectTeamMember, Customer } from '@/types/database'

type StepStatus = 'not_started' | 'in_progress' | 'completed' | 'problem'

const STEP_STATUS_CONFIG: Record<StepStatus, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  not_started: { label: 'Nicht gestartet', icon: Circle, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
  in_progress:  { label: 'In Bearbeitung', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  completed:    { label: 'Abgeschlossen', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  problem:      { label: 'Problem', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
}

const STATUS_EMOJI: Record<StepStatus, string> = {
  not_started: '⚪',
  in_progress: '🟡',
  completed: '🟢',
  problem: '🔴',
}

interface Props {
  project: Project & { customer?: Customer; steps?: ProjectStep[] }
  updates: ProjectUpdate[]
  team: ProjectTeamMember[]
  currentUserId: string
}

export function ProjectDetail({ project, updates: initialUpdates, team, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()
  const [steps, setSteps] = useState<ProjectStep[]>((project.steps ?? []) as ProjectStep[])
  const [updates, setUpdates] = useState(initialUpdates)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function updateStepStatus(stepId: string, newStatus: StepStatus) {
    const oldSteps = steps
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, status: newStatus } : s))

    const { error } = await supabase
      .from('project_steps')
      .update({ status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null })
      .eq('id', stepId)

    if (error) {
      setSteps(oldSteps)
      return
    }

    const step = steps.find(s => s.id === stepId)
    if (step) {
      await supabase.from('project_updates').insert({
        project_id: project.id,
        step_id: stepId,
        author_id: currentUserId,
        content: `Status geändert: "${step.title}" → ${STATUS_EMOJI[newStatus]} ${STEP_STATUS_CONFIG[newStatus].label}`,
        update_type: 'status_change',
      })
      startTransition(() => router.refresh())
    }
  }

  async function postComment() {
    if (!newComment.trim()) return
    setSubmitting(true)

    const { data: update } = await supabase
      .from('project_updates')
      .insert({
        project_id: project.id,
        author_id: currentUserId,
        content: newComment.trim(),
        update_type: 'comment',
      })
      .select('*, author:profiles(*)')
      .single()

    if (update) {
      setUpdates(prev => [update as ProjectUpdate, ...prev])
      setNewComment('')
    }
    setSubmitting(false)
  }

  const completedSteps = steps.filter(s => s.status === 'completed').length
  const progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0
  const problemSteps = steps.filter(s => s.status === 'problem').length

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Project Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-mono text-gray-600">{project.project_number}</span>
                <ProjectStatusBadge status={project.status} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{project.title}</h2>
              {project.description && <p className="text-gray-800 mt-1">{project.description}</p>}
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">{progress}%</div>
              <div className="text-sm text-gray-600">Fortschritt</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="w-full h-3 bg-gray-100 rounded-full">
              <div
                className={`h-full rounded-full transition-all ${problemSteps > 0 ? 'bg-red-500' : progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>{completedSteps}/{steps.length} Schritte abgeschlossen</span>
              {problemSteps > 0 && <span className="text-red-500">{problemSteps} Problem{problemSteps > 1 ? 'e' : ''}</span>}
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100 text-sm text-gray-800">
            {project.customer && (
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {project.customer.company_name ?? `${project.customer.first_name} ${project.customer.last_name}`}
              </span>
            )}
            {project.address_city && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {project.address_street && `${project.address_street}, `}{project.address_zip} {project.address_city}
              </span>
            )}
            {project.start_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDate(project.start_date)}
                {project.end_date && ` – ${formatDate(project.end_date)}`}
              </span>
            )}
            {project.budget && (
              <span className="flex items-center gap-1.5">
                <Euro className="w-4 h-4" />
                {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(project.budget)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Steps - Ampelsystem */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                Bauablauf & Ampelstatus
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {steps.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-600">
                  <p>Noch keine Arbeitsschritte definiert.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {steps.map((step, idx) => {
                    const config = STEP_STATUS_CONFIG[step.status as StepStatus] ?? STEP_STATUS_CONFIG.not_started
                    const StatusIcon = config.icon
                    return (
                      <div key={step.id} className={`flex items-center gap-3 px-5 py-4 ${config.bg} border-l-4 ${config.border} transition-colors`}>
                        <div className="flex-shrink-0 w-7 h-7 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-800 shadow-sm border border-gray-200">
                          {idx + 1}
                        </div>
                        <StatusIcon className={`w-5 h-5 flex-shrink-0 ${config.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{step.title}</p>
                          {step.due_date && (
                            <p className="text-xs text-gray-600 mt-0.5">Fällig: {formatDate(step.due_date)}</p>
                          )}
                        </div>
                        <Select
                          value={step.status}
                          onValueChange={(v) => updateStepStatus(step.id, v as StepStatus)}
                        >
                          <SelectTrigger className="w-44 h-8 text-xs bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_started">⚪ Nicht gestartet</SelectItem>
                            <SelectItem value="in_progress">🟡 In Bearbeitung</SelectItem>
                            <SelectItem value="completed">🟢 Abgeschlossen</SelectItem>
                            <SelectItem value="problem">🔴 Problem</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Updates / Feed */}
        <div className="lg:col-span-2 space-y-4">
          {/* New Comment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Baustellenupdate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Update oder Kommentar eingeben..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
              />
              <Button size="sm" onClick={postComment} disabled={submitting || !newComment.trim()} className="w-full">
                <Send className="w-4 h-4" />
                Update senden
              </Button>
            </CardContent>
          </Card>

          {/* Update Feed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Aktivitätsfeed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {updates.length === 0 ? (
                <div className="px-6 py-6 text-center text-gray-600 text-sm">Noch keine Updates</div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {updates.map(update => (
                    <div key={update.id} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                          {(update.author as { full_name?: string })?.full_name?.[0] ?? '?'}
                        </div>
                        <span className="text-xs font-medium text-gray-700">
                          {(update.author as { full_name?: string })?.full_name ?? 'Unbekannt'}
                        </span>
                        <span className="text-xs text-gray-600 ml-auto">
                          {formatDateTime(update.created_at)}
                        </span>
                      </div>
                      <p className={`text-sm ${update.update_type === 'status_change' ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                        {update.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ProjectStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }> = {
    active: { label: '● Aktiv', variant: 'default' },
    completed: { label: '✓ Abgeschlossen', variant: 'success' },
    planning: { label: '◷ Planung', variant: 'warning' },
    paused: { label: '⏸ Pausiert', variant: 'secondary' },
    cancelled: { label: '✕ Abgebrochen', variant: 'destructive' },
  }
  const { label, variant } = config[status] ?? { label: status, variant: 'secondary' }
  return <Badge variant={variant}>{label}</Badge>
}
