'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import { Car, Search, Plus, ChevronRight, Package, Tag, Gauge, Palette, Fuel, ArrowUpDown, Wrench, Euro, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'
import {
  type Auftrag, type FahrzeugStatus,
  FAHRZEUG_STATUS_LABEL, FAHRZEUG_STATUS_COLOR,
} from '@/types/database'
import { berechnePrioritaet, PRIORITAET_LABEL, PRIORITAET_COLOR, PRIORITAET_DOT } from '@/lib/prioritaet'
import { TuevWeckerContent } from '@/app/tuev-wecker/tuev-wecker-content'
import { ServiceWeckerContent } from '@/app/service-wecker/service-wecker-content'

const STATUS_FILTERS: { label: string; value: FahrzeugStatus | 'alle' }[] = [
  { label: 'Alle', value: 'alle' },
  { label: 'Angenommen', value: 'angenommen' },
  { label: 'Diagnose', value: 'diagnose' },
  { label: 'Reparatur', value: 'reparatur' },
  { label: 'Warten auf Teile', value: 'warten_teile' },
  { label: 'Fertig', value: 'fertig' },
  { label: 'Ausgeliefert', value: 'ausgeliefert' },
]

export function FahrzeugeContent({
  auftraege,
  tuevFahrzeuge,
  serviceFahrzeuge,
}: {
  auftraege: Auftrag[]
  tuevFahrzeuge: any[]
  serviceFahrzeuge: any[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'fremd' | 'eigen' | 'tuev' | 'service'>('fremd')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FahrzeugStatus | 'alle'>('alle')
  const [sortByPrio, setSortByPrio] = useState(true)
  const [verkaufenId, setVerkaufenId] = useState<string | null>(null)
  const [verkaufenLoading, setVerkaufenLoading] = useState(false)
  const [verkaufenPreis, setVerkaufenPreis] = useState('')
  const [verkaufenAuslieferung, setVerkaufenAuslieferung] = useState('')
  const [eigenSubTab, setEigenSubTab] = useState<'bestand' | 'verkauft'>('bestand')

  const fremdAuftraege = auftraege.filter(a => (a.fahrzeug as any)?.fahrzeug_typ !== 'eigen')
  const eigenAuftraege = auftraege.filter(a => (a.fahrzeug as any)?.fahrzeug_typ === 'eigen')
  const eigenImBestand = eigenAuftraege.filter(a => a.status !== 'ausgeliefert' && a.status !== 'storniert')
  const eigenVerkauft = eigenAuftraege.filter(a => a.status === 'ausgeliefert')

  async function handleVerkauft() {
    if (!verkaufenId) return
    setVerkaufenLoading(true)
    const sb = createClient()
    const updates: Record<string, any> = {
      status: 'ausgeliefert',
      verkauft_am: new Date().toISOString().split('T')[0],
    }
    const preis = parseFloat(verkaufenPreis.replace(',', '.'))
    if (!isNaN(preis) && preis > 0) updates.einnahmen = preis
    if (verkaufenAuslieferung) updates.auslieferung_geplant = verkaufenAuslieferung
    await sb.from('auftraege').update(updates).eq('id', verkaufenId)
    setVerkaufenLoading(false)
    setVerkaufenId(null)
    setVerkaufenPreis('')
    setVerkaufenAuslieferung('')
    router.refresh()
  }

  const filteredFremdRaw = fremdAuftraege.filter(a => {
    const matchStatus = statusFilter === 'alle' || a.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      a.fahrzeug?.marke?.toLowerCase().includes(q) ||
      a.fahrzeug?.modell?.toLowerCase().includes(q) ||
      a.fahrzeug?.kennzeichen?.toLowerCase().includes(q) ||
      a.kunde?.nachname?.toLowerCase().includes(q) ||
      a.kunde?.vorname?.toLowerCase().includes(q) ||
      a.auftrag_nr?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const filteredFremd = sortByPrio
    ? [...filteredFremdRaw].sort((a, b) => berechnePrioritaet(b).score - berechnePrioritaet(a).score)
    : filteredFremdRaw

  const filteredEigen = eigenImBestand.filter(a => {
    const q = search.toLowerCase()
    const fz = a.fahrzeug as any
    return !q ||
      fz?.marke?.toLowerCase().includes(q) ||
      fz?.modell?.toLowerCase().includes(q) ||
      fz?.kennzeichen?.toLowerCase().includes(q) ||
      fz?.mobile_de_id?.toLowerCase().includes(q) ||
      fz?.farbe?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fahrzeuge</h1>
          <p className="text-sm text-gray-800 mt-0.5">
            {fremdAuftraege.length} Kunden · {eigenImBestand.length} Lager{eigenVerkauft.length > 0 ? ` · ${eigenVerkauft.length} verkauft` : ''} · {tuevFahrzeuge.length} TÜV · {serviceFahrzeuge.length} Service
          </p>
        </div>
        <Link href="/fahrzeuge/neu">
          <Button className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Neues Fahrzeug
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        <button
          onClick={() => setTab('fremd')}
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all',
            tab === 'fremd' ? 'bg-orange-600 text-white border-orange-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          <Car className="w-4 h-4" />
          Kundenfahrzeuge
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full', tab === 'fremd' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>
            {fremdAuftraege.length}
          </span>
        </button>
        <button
          onClick={() => setTab('eigen')}
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all',
            tab === 'eigen' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          <Wrench className="w-4 h-4" />
          Lagerbestand
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full', tab === 'eigen' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>
            {eigenAuftraege.length}
          </span>
        </button>
        <button
          onClick={() => setTab('tuev')}
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all',
            tab === 'tuev' ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          <ShieldCheck className="w-4 h-4" />
          TÜV-Wecker
          {tuevFahrzeuge.length > 0 && (
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full', tab === 'tuev' ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700')}>
              {tuevFahrzeuge.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('service')}
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all',
            tab === 'service' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          <Wrench className="w-4 h-4" />
          Service-Wecker
          {serviceFahrzeuge.length > 0 && (
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full', tab === 'service' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700')}>
              {serviceFahrzeuge.length}
            </span>
          )}
        </button>
      </div>

      {/* Search — nur für Auftrags-Tabs */}
      {(tab === 'fremd' || tab === 'eigen') && <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'fremd' ? 'Marke, Modell, Kennzeichen, Kunde...' : 'Marke, Modell, B-Nummer, Farbe...'}
            className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        {tab === 'fremd' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            <button
              onClick={() => setSortByPrio(v => !v)}
              className={cn(
                'flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center gap-1.5',
                sortByPrio
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-600 border-gray-200'
              )}
            >
              <ArrowUpDown className="w-4 h-4" />
              Priorität
            </button>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors',
                  statusFilter === f.value
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* Fremdfahrzeuge */}
      {tab === 'fremd' && (
        filteredFremd.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Car className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-800">Keine Fahrzeuge gefunden</p>
              <Link href="/fahrzeuge/neu">
                <Button className="mt-4 bg-orange-600 hover:bg-orange-700 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Fahrzeug anlegen
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (<>
          {/* Karten-Ansicht: Handy + Tablet (unter xl:) */}
          <div className="xl:hidden space-y-2">
            {filteredFremd.map(auftrag => {
              const teile = auftrag.ersatzteile ?? []
              const kritisch = teile.filter((t: any) => ['nicht_bestellt', 'bestellt'].includes(t.status)).length
              const overdue = auftrag.geplante_fertigstellung &&
                auftrag.geplante_fertigstellung < new Date().toISOString().split('T')[0] &&
                !['fertig', 'ausgeliefert'].includes(auftrag.status)
              const prio = berechnePrioritaet(auftrag)

              return (
                <div
                  key={auftrag.id}
                  onClick={() => router.push(`/fahrzeuge/${auftrag.id}`)}
                  className={cn(
                    'bg-white border rounded-2xl px-4 py-4 flex items-center gap-4 cursor-pointer active:scale-[0.99] transition-all',
                    prio.stufe === 'kritisch' ? 'border-red-200 bg-red-50/30' : 'border-gray-200 hover:border-orange-200 hover:shadow-sm'
                  )}
                >
                  {/* Prioritäts-Dot */}
                  <div className={cn(
                    'w-1.5 self-stretch rounded-full flex-shrink-0',
                    prio.stufe === 'kritisch' ? 'bg-red-500' :
                    prio.stufe === 'hoch'     ? 'bg-orange-400' :
                    prio.stufe === 'mittel'   ? 'bg-yellow-400' : 'bg-gray-200'
                  )} />

                  {/* Auto-Icon */}
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Car className="w-6 h-6 text-gray-500" />
                  </div>

                  {/* Inhalt */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-base leading-tight truncate">
                          {auftrag.fahrzeug?.marke} {auftrag.fahrzeug?.modell}
                        </p>
                        <p className="text-sm text-gray-500 font-mono mt-0.5">{auftrag.fahrzeug?.kennzeichen}</p>
                      </div>
                      <span className={cn(
                        'flex-shrink-0 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border mt-0.5',
                        FAHRZEUG_STATUS_COLOR[auftrag.status]
                      )}>
                        {FAHRZEUG_STATUS_LABEL[auftrag.status]}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {auftrag.kunde && (
                        <span className="text-sm text-gray-600">
                          {auftrag.kunde.vorname} {auftrag.kunde.nachname}
                        </span>
                      )}
                      {auftrag.hebebuehne && (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                          {auftrag.hebebuehne.bezeichnung}
                        </span>
                      )}
                      {kritisch > 0 && (
                        <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Package className="w-3 h-3" /> {kritisch} Teile offen
                        </span>
                      )}
                      {overdue && (
                        <span className="text-xs text-red-600 font-medium">⚠ Überfällig</span>
                      )}
                      {auftrag.geplante_fertigstellung && !overdue && (
                        <span className="text-xs text-gray-400">
                          bis {formatDate(auftrag.geplante_fertigstellung)}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                </div>
              )
            })}
          </div>

          {/* Tabellen-Ansicht: nur Desktop (xl+) */}
          <div className="hidden xl:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Fahrzeug</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Kunde</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Priorität</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Bühne</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Teile</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Fertig bis</th>
                    <th className="w-8 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredFremd.map(auftrag => {
                    const teile = auftrag.ersatzteile ?? []
                    const kritisch = teile.filter((t: any) => ['nicht_bestellt', 'bestellt'].includes(t.status)).length
                    const overdue = auftrag.geplante_fertigstellung &&
                      auftrag.geplante_fertigstellung < new Date().toISOString().split('T')[0] &&
                      !['fertig', 'ausgeliefert'].includes(auftrag.status)
                    const prio = berechnePrioritaet(auftrag)
                    return (
                      <tr key={auftrag.id} onClick={() => router.push(`/fahrzeuge/${auftrag.id}`)} className={cn(
                        'hover:bg-orange-50/30 transition-colors cursor-pointer',
                        prio.stufe === 'kritisch' && 'bg-red-50/40'
                      )}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Car className="w-4 h-4 text-gray-800" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{auftrag.fahrzeug?.marke} {auftrag.fahrzeug?.modell}</p>
                              <p className="text-xs text-gray-600 font-mono">{auftrag.fahrzeug?.kennzeichen}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm text-gray-700">{auftrag.kunde?.vorname} {auftrag.kunde?.nachname}</p>
                          {auftrag.kunde?.firma && <p className="text-xs text-gray-600">{auftrag.kunde.firma}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border', FAHRZEUG_STATUS_COLOR[auftrag.status])}>
                            {FAHRZEUG_STATUS_LABEL[auftrag.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {prio.stufe !== 'normal' ? (
                            <div className="flex flex-col gap-1">
                              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', PRIORITAET_COLOR[prio.stufe])}>
                                <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITAET_DOT[prio.stufe])} />
                                {PRIORITAET_LABEL[prio.stufe]}
                              </span>
                              {prio.gruende[0] && <span className="text-[10px] text-gray-400 leading-tight">{prio.gruende[0]}</span>}
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {auftrag.hebebuehne ? <span className="text-sm text-gray-700">{auftrag.hebebuehne.bezeichnung}</span> : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {teile.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Package className="w-3.5 h-3.5 text-gray-600" />
                              <span className="text-sm text-gray-700">{teile.length}</span>
                              {kritisch > 0 && <span className="text-xs text-red-600 font-medium">({kritisch} offen)</span>}
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {auftrag.geplante_fertigstellung ? (
                            <span className={cn('text-sm', overdue ? 'text-red-600 font-medium' : 'text-gray-700')}>{formatDate(auftrag.geplante_fertigstellung)}</span>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>)
      )}

      {/* Eigenfahrzeuge */}
      {tab === 'eigen' && (
        <>
          {/* Sub-Tabs Bestand / Verkauft */}
          <div className="flex gap-2">
            <button
              onClick={() => setEigenSubTab('bestand')}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                eigenSubTab === 'bestand' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}
            >
              Im Bestand
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full', eigenSubTab === 'bestand' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>
                {eigenImBestand.length}
              </span>
            </button>
            <button
              onClick={() => setEigenSubTab('verkauft')}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                eigenSubTab === 'verkauft' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}
            >
              Verkauft
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full', eigenSubTab === 'verkauft' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>
                {eigenVerkauft.length}
              </span>
            </button>
          </div>

          {/* Verkauft-Liste */}
          {eigenSubTab === 'verkauft' && (
            eigenVerkauft.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 text-sm">Noch keine Fahrzeuge verkauft</p>
              </CardContent></Card>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fahrzeug</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Verkauft am</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Verkaufspreis</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Auslieferung</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {eigenVerkauft.map(a => {
                        const fz = a.fahrzeug as any
                        const vk = (a as any).verkauft_am
                        const al = (a as any).auslieferung_geplant
                        const preis = (a as any).einnahmen
                        const heute = new Date().toISOString().split('T')[0]
                        const ausstehend = al && al >= heute
                        return (
                          <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{fz?.marke} {fz?.modell}</p>
                              <p className="text-xs text-gray-400 font-mono">{fz?.kennzeichen || '—'}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {vk ? new Date(vk).toLocaleDateString('de-DE') : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {preis > 0
                                ? <span className="font-semibold text-green-700">{preis.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {al ? (
                                <span className={cn('text-sm', ausstehend ? 'text-orange-600 font-medium' : 'text-gray-500')}>
                                  {new Date(al).toLocaleDateString('de-DE')}
                                  {ausstehend && ' ⏳'}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/fahrzeuge/${a.id}`}>
                                <ChevronRight className="w-4 h-4 text-gray-300" />
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Bestand-Karten */}
          {eigenSubTab === 'bestand' && (filteredEigen.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Car className="w-12 h-12 mx-auto mb-3 text-purple-200" />
              <p className="text-gray-800">Kein Lagerbestand erfasst</p>
              <p className="text-sm text-gray-600 mt-1">Lege ein neues Fahrzeug an und wähle "Eigenfahrzeug" (Lagerbestand)</p>
              <Link href="/fahrzeuge/neu">
                <Button className="mt-4 bg-purple-600 hover:bg-purple-700 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Eigenfahrzeug anlegen
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEigen.map(auftrag => {
              const fz = auftrag.fahrzeug as any
              const preisMatch = fz?.notizen?.match(/Verkaufspreis:\s*([\d.,]+)\s*€/)
              const verkaufspreis = preisMatch ? preisMatch[1] : null
              const bilderUrls: string[] = (() => { try { return fz?.bilder_urls ? JSON.parse(fz.bilder_urls) : [] } catch { return [] } })()
              const hauptbild = bilderUrls[0] ?? null
              const teile = (auftrag.ersatzteile ?? []) as any[]
              const teileKosten = teile.reduce((s: number, t: any) => s + (t.einzelpreis ?? 0) * (t.menge ?? 1), 0)
              const einnahmen: number = (auftrag as any).einnahmen ?? 0

              return (
                <div key={auftrag.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-purple-300 hover:shadow-md transition-all group flex flex-col">
                  <Link href={`/fahrzeuge/${auftrag.id}`} className="flex-1">
                    {hauptbild && (
                      <div className="h-36 w-full overflow-hidden bg-gray-100">
                        <img src={hauptbild} alt={`${fz?.marke} ${fz?.modell}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    )}
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {!hauptbild && (
                            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                              <Car className="w-4 h-4 text-purple-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">
                              {fz?.marke} {fz?.modell}
                            </p>
                            {fz?.mobile_de_id && (
                              <p className="text-xs font-mono text-purple-500">{fz.mobile_de_id}</p>
                            )}
                          </div>
                        </div>
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', FAHRZEUG_STATUS_COLOR[auftrag.status])}>
                          {FAHRZEUG_STATUS_LABEL[auftrag.status]}
                        </span>
                      </div>

                      {/* Fahrzeugdaten */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-600 mb-3">
                        {fz?.baujahr && <div className="flex items-center gap-1"><Tag className="w-3 h-3" /><span>{fz.baujahr}</span></div>}
                        {fz?.kilometerstand && <div className="flex items-center gap-1"><Gauge className="w-3 h-3" /><span>{fz.kilometerstand.toLocaleString('de-DE')} km</span></div>}
                        {fz?.farbe && <div className="flex items-center gap-1"><Palette className="w-3 h-3" /><span>{fz.farbe}</span></div>}
                        {fz?.motortyp && <div className="flex items-center gap-1"><Fuel className="w-3 h-3" /><span>{fz.motortyp}{fz.leistung_kw ? ` · ${fz.leistung_kw} kW` : ''}</span></div>}
                      </div>

                      {/* Arbeiten */}
                      {auftrag.arbeiten && (
                        <div className="flex items-start gap-1.5 text-xs text-gray-600 mb-3 bg-gray-50 rounded-lg px-2.5 py-2">
                          <Wrench className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-400" />
                          <span className="line-clamp-2">{auftrag.arbeiten}</span>
                        </div>
                      )}

                      {/* Kosten-Zeile */}
                      {(einnahmen > 0 || teile.length > 0) && (
                        <div className="flex items-center gap-3 mb-3 text-xs">
                          {einnahmen > 0 && (
                            <div className="flex items-center gap-1 text-purple-700 font-semibold">
                              <Euro className="w-3 h-3" />
                              <span>{einnahmen.toLocaleString('de-DE', { minimumFractionDigits: 2 })} Gesamtkosten</span>
                            </div>
                          )}
                          {teile.length > 0 && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <Package className="w-3 h-3" />
                              <span>{teile.length} {teile.length === 1 ? 'Teil' : 'Teile'}</span>
                              {teileKosten > 0 && <span className="text-gray-400">· {teileKosten.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Kennzeichen + Verkaufspreis */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <span className="text-xs font-mono text-gray-500">{fz?.kennzeichen || 'Kein KZ'}</span>
                        {verkaufspreis && (
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400 leading-none mb-0.5">Verkaufspreis</p>
                            <p className="text-sm font-bold text-purple-700">{verkaufspreis} €</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Verkauft-Button */}
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => setVerkaufenId(auftrag.id)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-purple-200 text-purple-700 text-sm font-medium hover:bg-purple-50 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Als verkauft markieren
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        </>
      )}

      {/* TÜV-Wecker Tab */}
      {tab === 'tuev' && (
        <TuevWeckerContent fahrzeuge={tuevFahrzeuge} />
      )}

      {/* Service-Wecker Tab */}
      {tab === 'service' && (
        <ServiceWeckerContent fahrzeuge={serviceFahrzeuge} />
      )}

      {/* Verkauft-Bestätigungsmodal */}
      {verkaufenId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Fahrzeug als verkauft markieren?</h2>
                <p className="text-sm text-gray-500 mt-0.5">Das Fahrzeug wird aus dem Lagerbestand entfernt und im Verlauf archiviert.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verkaufspreis (optional)</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={verkaufenPreis}
                    onChange={e => setVerkaufenPreis(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auslieferung geplant</label>
                <input
                  type="date"
                  value={verkaufenAuslieferung}
                  onChange={e => setVerkaufenAuslieferung(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setVerkaufenId(null); setVerkaufenPreis(''); setVerkaufenAuslieferung('') }} disabled={verkaufenLoading}>
                Abbrechen
              </Button>
              <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" onClick={handleVerkauft} disabled={verkaufenLoading}>
                {verkaufenLoading ? 'Speichern…' : '✓ Verkauft'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
