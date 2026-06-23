// @ts-nocheck
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, TrendingUp, ArrowRight, Loader2, Euro } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Lead, Customer, Profile } from '@/types/database'

type LeadStatus = 'new' | 'contacted' | 'offer_sent' | 'negotiating' | 'won' | 'lost'

const LEAD_STAGES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'Neu', color: 'bg-gray-100 text-gray-700' },
  { value: 'contacted', label: 'Kontaktiert', color: 'bg-blue-100 text-blue-700' },
  { value: 'offer_sent', label: 'Angebot gesendet', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'negotiating', label: 'Verhandlung', color: 'bg-orange-100 text-orange-700' },
  { value: 'won', label: 'Gewonnen', color: 'bg-green-100 text-green-700' },
  { value: 'lost', label: 'Verloren', color: 'bg-red-100 text-red-700' },
]

interface Props {
  leads: (Lead & { customer?: Customer; assigned_profile?: Profile })[]
  customers: Customer[]
  profiles: Profile[]
  currentUserId: string
}

export function LeadsContent({ leads: initialLeads, customers, profiles, currentUserId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [leads, setLeads] = useState(initialLeads)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', customer_id: '',
    estimated_value: '', assigned_to: currentUserId, source: '',
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.from('leads').insert({
      title: form.title,
      description: form.description || undefined,
      customer_id: form.customer_id || undefined,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : undefined,
      assigned_to: form.assigned_to || undefined,
      source: form.source || undefined,
      status: 'new',
    }).select('*, customer:customers(*), assigned_profile:profiles(*)').single()
    if (!error && data) {
      setLeads(prev => [data as Lead & { customer?: Customer; assigned_profile?: Profile }, ...prev])
      setOpen(false)
    }
    setLoading(false)
  }

  async function updateLeadStatus(leadId: string, newStatus: LeadStatus) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    await supabase.from('leads').update({ status: newStatus }).eq('id', leadId)
  }

  async function convertToProject(lead: Lead & { customer?: Customer }) {
    router.push(`/projekte/neu?lead_id=${lead.id}&customer_id=${lead.customer_id ?? ''}&title=${encodeURIComponent(lead.title)}`)
  }

  const groupedLeads = LEAD_STAGES.reduce((acc, stage) => {
    acc[stage.value] = leads.filter(l => l.status === stage.value)
    return acc
  }, {} as Record<string, typeof leads>)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{leads.length} Leads</h2>
          <p className="text-sm text-gray-800">Kundenanfragen und Vertriebsphase</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4" />Neuer Lead</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Neuen Lead erfassen</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="z.B. Dachausbau Familie Müller" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kunde</label>
                <Select value={form.customer_id} onValueChange={v => setForm(f => ({ ...f, customer_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Kunde wählen..." /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name ?? `${c.first_name} ${c.last_name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Geschätzter Auftragswert (â‚¬)</label>
                <Input type="number" value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quelle</label>
                <Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="z.B. Empfehlung, Website, Messe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">Abbrechen</Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Anlegen'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 overflow-x-auto">
        {LEAD_STAGES.map(stage => (
          <div key={stage.value} className="min-w-[160px]">
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-2 ${stage.color}`}>
              <span className="text-xs font-semibold">{stage.label}</span>
              <span className="text-xs font-bold">{groupedLeads[stage.value]?.length ?? 0}</span>
            </div>
            <div className="space-y-2">
              {(groupedLeads[stage.value] ?? []).map(lead => (
                <Card key={lead.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium text-gray-900 leading-tight">{lead.title}</p>
                    {lead.customer && (
                      <p className="text-xs text-gray-800 mt-1 truncate">
                        {lead.customer.company_name ?? `${lead.customer.first_name} ${lead.customer.last_name}`}
                      </p>
                    )}
                    {lead.estimated_value && (
                      <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-0.5">
                        <Euro className="w-3 h-3" />
                        {new Intl.NumberFormat('de-DE').format(lead.estimated_value)}
                      </p>
                    )}
                    <div className="mt-2 space-y-1">
                      <Select value={lead.status} onValueChange={v => updateLeadStatus(lead.id, v as LeadStatus)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {(lead.status === 'won' || lead.status === 'negotiating') && (
                        <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => convertToProject(lead)}>
                          <ArrowRight className="w-3 h-3" />Zu Projekt
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

