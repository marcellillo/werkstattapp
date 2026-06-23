// @ts-nocheck
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Filter, FolderOpen, MapPin, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { Project, Customer, ProjectStep } from '@/types/database'

type ProjectWithRelations = Project & { customer?: Customer; steps?: ProjectStep[] }

const STATUS_FILTERS = [
  { value: 'all', label: 'Alle' },
  { value: 'active', label: 'Aktiv' },
  { value: 'planning', label: 'Planung' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'paused', label: 'Pausiert' },
]

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  active: { label: 'Aktiv', variant: 'default' },
  completed: { label: 'Abgeschlossen', variant: 'success' },
  planning: { label: 'Planung', variant: 'warning' },
  paused: { label: 'Pausiert', variant: 'secondary' },
  cancelled: { label: 'Abgebrochen', variant: 'destructive' },
}

export function ProjecteContent({ projects }: { projects: ProjectWithRelations[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = projects.filter(p => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.project_number.toLowerCase().includes(search.toLowerCase()) ||
      p.customer?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.address_city?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{projects.length} Projekte gesamt</h2>
          <p className="text-sm text-gray-800">Alle Bauvorhaben im Überblick</p>
        </div>
        <Link href="/projekte/neu">
          <Button>
            <Plus className="w-4 h-4" />
            Neues Projekt
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Projekt, Nummer, Kunde suchen..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-800 font-medium">Keine Projekte gefunden</p>
          <p className="text-sm text-gray-600">Passen Sie Ihren Suchbegriff an oder legen Sie ein neues Projekt an.</p>
          <Link href="/projekte/neu">
            <Button className="mt-4">Neues Projekt anlegen</Button>
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(project => <ProjectCard key={project.id} project={project} />)}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: ProjectWithRelations }) {
  const steps = project.steps ?? []
  const done = steps.filter(s => s.status === 'completed').length
  const problems = steps.filter(s => s.status === 'problem').length
  const progress = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0
  const { label, variant } = STATUS_BADGE[project.status] ?? { label: project.status, variant: 'secondary' }

  const progressColor = problems > 0 ? 'bg-red-500' : progress === 100 ? 'bg-green-500' : 'bg-blue-500'

  return (
    <Link href={`/projekte/${project.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-600 font-mono">{project.project_number}</p>
              <h3 className="font-semibold text-gray-900 mt-0.5 leading-tight">{project.title}</h3>
            </div>
            <Badge variant={variant} className="flex-shrink-0">{label}</Badge>
          </div>

          {/* Customer */}
          {project.customer && (
            <p className="text-sm text-gray-800 mb-2">
              {project.customer.company_name ?? `${project.customer.first_name} ${project.customer.last_name}`}
            </p>
          )}

          {/* Location & Date */}
          <div className="flex items-center gap-3 text-xs text-gray-600 mb-4">
            {project.address_city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {project.address_city}
              </span>
            )}
            {project.start_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {formatDate(project.start_date)}
              </span>
            )}
          </div>

          {/* Progress */}
          {steps.length > 0 && (
            <div>
              <div className="flex justify-between text-xs text-gray-800 mb-1">
                <span>{done}/{steps.length} Schritte</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full">
                <div className={`h-full ${progressColor} rounded-full transition-all`} style={{ width: `${progress}%` }} />
              </div>
              {problems > 0 && (
                <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                  🔴 {problems} Problem{problems > 1 ? 'e' : ''}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}


