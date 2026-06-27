'use client'
import { useState } from 'react'
import { Users, Search, Plus, Phone, MapPin, Building, Car, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Kunde } from '@/types/database'

type Auftrag = {
  id: string
  auftrag_nr?: string
  status?: string
  arbeiten?: string
  erstellt_am?: string
  geplante_fertigstellung?: string
  einnahmen?: number
}

type Fahrzeug = {
  id: string
  marke?: string
  modell?: string
  kennzeichen?: string
  baujahr?: number
  auftraege?: Auftrag[]
}

type KundeMitAuftraegen = Kunde & {
  fahrzeuge?: Fahrzeug[]
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  angenommen:   { label: 'Angenommen',      bg: 'bg-blue-100',   text: 'text-blue-700' },
  diagnose:     { label: 'Diagnose',        bg: 'bg-purple-100', text: 'text-purple-700' },
  reparatur:    { label: 'In Arbeit',       bg: 'bg-orange-100', text: 'text-orange-700' },
  warten_teile: { label: 'Warten auf Teile',bg: 'bg-yellow-100', text: 'text-yellow-700' },
  fertig:       { label: 'Fertig',          bg: 'bg-green-100',  text: 'text-green-700' },
  ausgeliefert: { label: 'Ausgeliefert',    bg: 'bg-gray-100',   text: 'text-gray-600' },
  storniert:    { label: 'Storniert',       bg: 'bg-red-100',    text: 'text-red-600' },
}

function StatusBadge({ status }: { status?: string }) {
  const cfg = status ? STATUS_CONFIG[status] : undefined
  if (!cfg) return <span className="text-xs text-gray-400">{status ?? '—'}</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function AuftragsUebersicht({ kunden }: { kunden: KundeMitAuftraegen[] }) {
  const [expandedKunden, setExpandedKunden] = useState<Set<string>>(new Set())
  const [expandedFahrzeuge, setExpandedFahrzeuge] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  function toggleKunde(id: string) {
    setExpandedKunden(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleFahrzeug(id: string) {
    setExpandedFahrzeuge(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = kunden.filter(k => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      k.vorname?.toLowerCase().includes(q) ||
      k.nachname?.toLowerCase().includes(q) ||
      k.firma?.toLowerCase().includes(q) ||
      k.fahrzeuge?.some(f =>
        f.kennzeichen?.toLowerCase().includes(q) ||
        f.marke?.toLowerCase().includes(q) ||
        f.modell?.toLowerCase().includes(q) ||
        f.auftraege?.some(a => a.auftrag_nr?.toLowerCase().includes(q) || a.arbeiten?.toLowerCase().includes(q))
      )
    )
  })

  const totalAuftraege = kunden.reduce((sum, k) =>
    sum + (k.fahrzeuge?.reduce((s, f) => s + (f.auftraege?.length ?? 0), 0) ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{filtered.length} Kunden · {totalAuftraege} Aufträge gesamt</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Kunde, Kennzeichen, Auftrag..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600">Keine Einträge gefunden</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(k => {
            const isOpen = expandedKunden.has(k.id)
            const fahrzeugCount = k.fahrzeuge?.length ?? 0
            const auftragCount = k.fahrzeuge?.reduce((s, f) => s + (f.auftraege?.length ?? 0), 0) ?? 0
            return (
              <Card key={k.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-gray-50"
                  onClick={() => toggleKunde(k.id)}
                >
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 font-bold text-sm">
                      {k.vorname?.charAt(0) ?? ''}{k.nachname?.charAt(0) ?? ''}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{k.vorname} {k.nachname}</p>
                    <p className="text-xs text-gray-500">
                      {k.firma ? `${k.firma} · ` : ''}{fahrzeugCount} Fahrzeug{fahrzeugCount !== 1 ? 'e' : ''} · {auftragCount} Auftrag{auftragCount !== 1 ? 'äge' : ''}
                    </p>
                  </div>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  }
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100">
                    {!fahrzeugCount ? (
                      <p className="px-4 py-3 text-sm text-gray-400 italic">Keine Fahrzeuge eingetragen</p>
                    ) : (
                      k.fahrzeuge!.map(f => {
                        const fOpen = expandedFahrzeuge.has(f.id)
                        const auftraege = f.auftraege ?? []
                        return (
                          <div key={f.id} className="border-b border-gray-50 last:border-b-0">
                            <div
                              className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => toggleFahrzeug(f.id)}
                            >
                              <Car className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800">
                                  {[f.marke, f.modell].filter(Boolean).join(' ') || 'Unbekanntes Fahrzeug'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {f.kennzeichen ?? '—'}{f.baujahr ? ` · ${f.baujahr}` : ''}
                                  {' · '}{auftraege.length} Auftrag{auftraege.length !== 1 ? 'äge' : ''}
                                </p>
                              </div>
                              {fOpen
                                ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                              }
                            </div>

                            {fOpen && (
                              <div className="divide-y divide-gray-50">
                                {auftraege.length === 0 ? (
                                  <p className="px-5 py-3 text-xs text-gray-400 italic">Keine Aufträge vorhanden</p>
                                ) : (
                                  auftraege.map(a => (
                                    <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                                      <ClipboardList className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-sm font-medium text-gray-800">
                                            {a.auftrag_nr ? `#${a.auftrag_nr}` : 'Auftrag'}
                                          </span>
                                          <StatusBadge status={a.status} />
                                        </div>
                                        {a.arbeiten && (
                                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.arbeiten}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-1">
                                          {a.erstellt_am && (
                                            <span className="text-xs text-gray-400">
                                              {new Date(a.erstellt_am).toLocaleDateString('de-DE')}
                                            </span>
                                          )}
                                          {a.einnahmen != null && (
                                            <span className="text-xs font-semibold text-orange-600">
                                              {a.einnahmen.toFixed(2)} €
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function KundenContent({
  kunden: initialKunden,
  kundenMitAuftraegen,
}: {
  kunden: Kunde[]
  kundenMitAuftraegen: KundeMitAuftraegen[]
}) {
  const [kunden, setKunden] = useState(initialKunden)
  const [activeTab, setActiveTab] = useState<'kunden' | 'auftraege'>('kunden')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    vorname: '', nachname: '', firma: '', email: '', telefon: '', mobil: '', strasse: '', plz: '', ort: ''
  })
  const supabase = createClient()

  const filtered = kunden.filter(k => {
    const q = search.toLowerCase()
    return !q ||
      k.vorname?.toLowerCase().includes(q) ||
      k.nachname?.toLowerCase().includes(q) ||
      k.firma?.toLowerCase().includes(q) ||
      k.telefon?.includes(q) ||
      k.ort?.toLowerCase().includes(q)
  })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nachname) return
    setSaving(true)
    const { data } = await supabase.from('kunden').insert({
      vorname: form.vorname || null,
      nachname: form.nachname,
      firma: form.firma || null,
      email: form.email || null,
      telefon: form.telefon || null,
      mobil: form.mobil || null,
      strasse: form.strasse || null,
      plz: form.plz || null,
      ort: form.ort || null,
    }).select().single()
    if (data) {
      setKunden(prev => [data as Kunde, ...prev])
      setForm({ vorname: '', nachname: '', firma: '', email: '', telefon: '', mobil: '', strasse: '', plz: '', ort: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kunden</h1>
          <p className="text-sm text-gray-800 mt-0.5">{kunden.length} Kunden gesamt</p>
        </div>
        {activeTab === 'kunden' && (
          <Button onClick={() => setShowForm(v => !v)} className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" />Neuer Kunde
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('kunden')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'kunden'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2"><Users className="w-4 h-4" />Kunden</span>
        </button>
        <button
          onClick={() => setActiveTab('auftraege')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'auftraege'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2"><ClipboardList className="w-4 h-4" />Auftragsübersicht</span>
        </button>
      </div>

      {activeTab === 'kunden' ? (
        <>
          {showForm && (
            <Card>
              <CardContent className="pt-4">
                <form onSubmit={handleAdd} className="space-y-3">
                  <h3 className="font-semibold text-gray-800 mb-3">Neuen Kunden anlegen</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(['vorname', 'nachname', 'firma', 'email', 'telefon', 'mobil', 'strasse', 'plz', 'ort'] as const).map(key => (
                      <div key={key} className={['firma','email','strasse'].includes(key) ? 'col-span-2' : ''}>
                        <label className="text-xs text-gray-800 mb-1 block capitalize">{key}{key === 'nachname' ? ' *' : ''}</label>
                        <input
                          value={form[key]}
                          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
                      {saving ? 'Speichern...' : 'Kunde anlegen'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Abbrechen</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, Firma, Ort..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>

          {filtered.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-800">Keine Kunden gefunden</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(k => (
                <Card key={k.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 font-bold text-sm">
                          {(k.vorname?.charAt(0) ?? '')}{(k.nachname?.charAt(0) ?? '')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{k.vorname} {k.nachname}</p>
                        {k.firma && <p className="text-xs text-gray-800 flex items-center gap-1 mt-0.5"><Building className="w-3 h-3" />{k.firma}</p>}
                        {k.telefon && <p className="text-xs text-gray-800 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{k.telefon}</p>}
                        {k.ort && <p className="text-xs text-gray-800 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{k.ort}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <AuftragsUebersicht kunden={kundenMitAuftraegen} />
      )}
    </div>
  )
}
