// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Trash2, Layers, Star, Loader2 } from 'lucide-react'
import type { WorkflowTemplate, WorkflowTemplateStep } from '@/types/database'

type TemplateWithSteps = WorkflowTemplate & { steps?: WorkflowTemplateStep[] }

interface Props {
  templates: TemplateWithSteps[]
  currentUserId: string
}

export function VorlagenContent({ templates: initial, currentUserId }: Props) {
  const supabase = createClient()
  const [templates, setTemplates] = useState(initial)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<string[]>([''])
  const [expanded, setExpanded] = useState<string | null>(null)

  function addStepField() { setSteps(prev => [...prev, '']) }
  function removeStepField(idx: number) { setSteps(prev => prev.filter((_, i) => i !== idx)) }
  function updateStep(idx: number, val: string) { setSteps(prev => { const n = [...prev]; n[idx] = val; return n }) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: tpl, error } = await supabase
      .from('workflow_templates')
      .insert({ name, description: description || undefined, created_by: currentUserId, is_default: false })
      .select()
      .single()

    if (error || !tpl) { setLoading(false); return }

    const validSteps = steps.filter(s => s.trim())
    if (validSteps.length > 0) {
      await supabase.from('workflow_template_steps').insert(
        validSteps.map((s, i) => ({ template_id: tpl.id, title: s.trim(), order_index: i + 1 }))
      )
    }

    const { data: withSteps } = await supabase
      .from('workflow_templates')
      .select('*, steps:workflow_template_steps(*)')
      .eq('id', tpl.id)
      .single()

    if (withSteps) setTemplates(prev => [withSteps as TemplateWithSteps, ...prev])
    setOpen(false)
    setName(''); setDescription(''); setSteps([''])
    setLoading(false)
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Vorlage wirklich löschen?')) return
    await supabase.from('workflow_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{templates.length} Vorlagen</h2>
          <p className="text-sm text-gray-800">Wiederverwendbare Bauabläufe definieren</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4" />Neue Vorlage</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Neue Workflow-Vorlage</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Dachsanierung Standard" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Kurze Beschreibung..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Arbeitsschritte</label>
                <div className="space-y-2">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <Input
                        value={step}
                        onChange={e => updateStep(idx, e.target.value)}
                        placeholder={`Schritt ${idx + 1}...`}
                        className="flex-1"
                      />
                      {steps.length > 1 && (
                        <button type="button" onClick={() => removeStepField(idx)} className="text-gray-600 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={addStepField} className="mt-2">
                  <Plus className="w-3 h-3" /> Schritt hinzufügen
                </Button>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">Abbrechen</Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Erstellen'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {templates.map(tpl => {
          const isExpanded = expanded === tpl.id
          const sortedSteps = (tpl.steps ?? []).sort((a, b) => a.order_index - b.order_index)
          return (
            <Card key={tpl.id}>
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : tpl.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Layers className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{tpl.name}</span>
                        {tpl.is_default && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                      </div>
                      <span className="text-xs text-gray-600">{sortedSteps.length} Schritte</span>
                    </div>
                  </button>
                  {!tpl.is_default && (
                    <button onClick={() => deleteTemplate(tpl.id)} className="text-gray-300 hover:text-red-500 transition-colors p-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </CardHeader>
              {isExpanded && sortedSteps.length > 0 && (
                <CardContent className="pt-3">
                  <div className="space-y-1.5">
                    {sortedSteps.map((step, idx) => (
                      <div key={step.id} className="flex items-center gap-3 py-1.5 px-3 bg-gray-50 rounded-lg">
                        <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm text-gray-700">{step.title}</span>
                        {step.estimated_days && (
                          <span className="ml-auto text-xs text-gray-600">{step.estimated_days} Tage</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

