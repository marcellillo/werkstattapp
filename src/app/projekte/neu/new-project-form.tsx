// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Trash2, GripVertical } from 'lucide-react'
import type { Customer, WorkflowTemplate, WorkflowTemplateStep } from '@/types/database'

interface Props {
  customers: Customer[]
  templates: (WorkflowTemplate & { steps?: WorkflowTemplateStep[] })[]
}

interface StepDraft {
  title: string
  order_index: number
}

export function NewProjectForm({ customers, templates }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressZip, setAddressZip] = useState('')
  const [steps, setSteps] = useState<StepDraft[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [newStepTitle, setNewStepTitle] = useState('')

  function applyTemplate(templateId: string) {
    setSelectedTemplate(templateId)
    const template = templates.find(t => t.id === templateId)
    if (template?.steps) {
      const sorted = [...template.steps].sort((a, b) => a.order_index - b.order_index)
      setSteps(sorted.map((s, i) => ({ title: s.title, order_index: i + 1 })))
    }
  }

  function addStep() {
    if (!newStepTitle.trim()) return
    setSteps(prev => [...prev, { title: newStepTitle.trim(), order_index: prev.length + 1 }])
    setNewStepTitle('')
  }

  function removeStep(idx: number) {
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order_index: i + 1 })))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Projektbezeichnung ist erforderlich.'); return }
    setLoading(true)
    setError('')

    const { data: project, error: projError } = await supabase
      .from('projects')
      .insert({
        title: title.trim(),
        description: description.trim() || undefined,
        customer_id: customerId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        budget: budget ? parseFloat(budget) : undefined,
        address_street: addressStreet || undefined,
        address_city: addressCity || undefined,
        address_zip: addressZip || undefined,
        status: 'planning',
        project_number: '',
        created_by: (await supabase.auth.getUser()).data.user?.id ?? '',
      })
      .select()
      .single()

    if (projError || !project) {
      setError('Fehler beim Erstellen des Projekts.')
      setLoading(false)
      return
    }

    if (steps.length > 0) {
      await supabase.from('project_steps').insert(
        steps.map(s => ({
          project_id: project.id,
          title: s.title,
          order_index: s.order_index,
          status: 'not_started' as const,
        }))
      )
    }

    router.push(`/projekte/${project.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Projektinformationen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Projektbezeichnung *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Einfamilienhaus Musterstraße 5" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Beschreibung</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Projektbeschreibung..."
              rows={3}
              className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kunde</label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Kunde auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name ?? `${c.first_name} ${c.last_name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Startdatum</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Enddatum (geplant)</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Budget (â‚¬)</label>
            <Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0,00" step="0.01" />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle>Baustellenadresse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Straße & Hausnummer</label>
            <Input value={addressStreet} onChange={e => setAddressStreet(e.target.value)} placeholder="Musterstraße 5" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">PLZ</label>
              <Input value={addressZip} onChange={e => setAddressZip(e.target.value)} placeholder="12345" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Stadt</label>
              <Input value={addressCity} onChange={e => setAddressCity(e.target.value)} placeholder="Musterstadt" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Bauablauf</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vorlage übernehmen</label>
              <Select value={selectedTemplate} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Vorlage auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {steps.length > 0 && (
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <Input
                    value={step.title}
                    onChange={e => {
                      const newSteps = [...steps]
                      newSteps[idx] = { ...step, title: e.target.value }
                      setSteps(newSteps)
                    }}
                    className="flex-1 h-8 bg-white"
                  />
                  <button type="button" onClick={() => removeStep(idx)} className="text-gray-600 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newStepTitle}
              onChange={e => setNewStepTitle(e.target.value)}
              placeholder="Neuen Schritt hinzufügen..."
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStep())}
            />
            <Button type="button" variant="outline" onClick={addStep}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Abbrechen</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Wird erstellt...</> : 'Projekt anlegen'}
        </Button>
      </div>
    </form>
  )
}

