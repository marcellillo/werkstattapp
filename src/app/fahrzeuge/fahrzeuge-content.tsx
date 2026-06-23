'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Car, Search, Plus, ChevronRight, Package, Tag, Gauge, Palette, Fuel, ArrowUpDown, Wrench, Euro } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'
import {
  type Auftrag, type FahrzeugStatus,
  FAHRZEUG_STATUS_LABEL, FAHRZEUG_STATUS_COLOR,
} from '@/types/database'
import { berechnePrioritaet, PRIORITAET_LABEL, PRIORITAET_COLOR, PRIORITAET_DOT } from '@/lib/prioritaet'

const STATUS_FILTERS: { label: string; value: FahrzeugStatus | 'alle' }[] = [
  { label: 'Alle', value: 'alle' },
  { label: 'Angenommen', value: 'angenommen' },
  { label: 'Diagnose', value: 'diagnose' },
  { label: 'Reparatur', value: 'reparatur' },
  { label: 'Warten auf Teile', value: 'warten_teile' },
  { label: 'Fertig', value: 'fertig' },
  { label: 'Ausgeliefert', value: 'ausgeliefert' },
]

export function FahrzeugeContent({ auftraege }: { auftraege: Auftrag[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<'fremd' | 'eigen'>('fremd')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FahrzeugStatus | 'alle'>('alle')
  const [sortByPrio, setSortByPrio] = useState(true)

  const fremdAuftraege = auftraege.filter(a => (a.fahrzeug as any)?.fahrzeug_typ !== 'eigen')
  const eigenAuftraege = auftraege.filter(a => (a.fahrzeug as any)?.fahrzeug_typ === 'eigen')

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

  const filteredEigen = eigenAuftraege.filter(a => {
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
            {fremdAuftraege.length} Kunden · {eigenAuftraege.length} Lager
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
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setTab('fremd')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-all',
            tab === 'fremd' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          )}
        >
          Kundenfahrzeuge
          <span className="ml-1.5 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
            {fremdAuftraege.length}
          </span>
        </button>
        <button
          onClick={() => setTab('eigen')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-all',
            tab === 'eigen' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          )}
        >
          Lagerbestand
          <span className="ml-1.5 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
            {eigenAuftraege.length}
          </span>
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'fremd' ? 'Marke, Modell, Kennzeichen, Kunde...' : 'Marke, Modell, B-Nummer, Farbe...'}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        {tab === 'fremd' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSortByPrio(v => !v)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5',
                sortByPrio
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              )}
            >
              <ArrowUpDown className="w-3 h-3" />
              Nach Priorität
            </button>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
                  statusFilter === f.value
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fremdfahrzeuge — Tabelle */}
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
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Fahrzeug</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Kunde</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Priorität</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Bühne</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Teile</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3 hidden xl:table-cell">Fertig bis</th>
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
                                <p className="font-medium text-gray-900 text-sm">
                                  {auftrag.fahrzeug?.marke} {auftrag.fahrzeug?.modell}
                                </p>
                                <p className="text-xs text-gray-600 font-mono">{auftrag.fahrzeug?.kennzeichen}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <p className="text-sm text-gray-700">
                              {auftrag.kunde?.vorname} {auftrag.kunde?.nachname}
                            </p>
                            {auftrag.kunde?.firma && (
                              <p className="text-xs text-gray-600">{auftrag.kunde.firma}</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn(
                              'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border',
                              FAHRZEUG_STATUS_COLOR[auftrag.status]
                            )}>
                              {FAHRZEUG_STATUS_LABEL[auftrag.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 hidden sm:table-cell">
                            {prio.stufe !== 'normal' ? (
                              <div className="flex flex-col gap-1">
                                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', PRIORITAET_COLOR[prio.stufe])}>
                                  <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITAET_DOT[prio.stufe])} />
                                  {PRIORITAET_LABEL[prio.stufe]}
                                </span>
                                {prio.gruende[0] && (
                                  <span className="text-[10px] text-gray-400 leading-tight">{prio.gruende[0]}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 hidden lg:table-cell">
                            {auftrag.hebebuehne ? (
                              <span className="text-sm text-gray-700">{auftrag.hebebuehne.bezeichnung}</span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 hidden lg:table-cell">
                            {teile.length > 0 ? (
                              <div className="flex items-center gap-1">
                                <Package className="w-3.5 h-3.5 text-gray-600" />
                                <span className="text-sm text-gray-700">{teile.length}</span>
                                {kritisch > 0 && (
                                  <span className="text-xs text-red-600 font-medium">({kritisch} offen)</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 hidden xl:table-cell">
                            {auftrag.geplante_fertigstellung ? (
                              <span className={cn('text-sm', overdue ? 'text-red-600 font-medium' : 'text-gray-700')}>
                                {formatDate(auftrag.geplante_fertigstellung)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <ChevronRight className="w-4 h-4 text-gray-300" />
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

      {/* Eigenfahrzeuge — Karten */}
      {tab === 'eigen' && (
        filteredEigen.length === 0 ? (
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
                <Link key={auftrag.id} href={`/fahrzeuge/${auftrag.id}`}>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group">
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
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full border',
                          FAHRZEUG_STATUS_COLOR[auftrag.status]
                        )}>
                          {FAHRZEUG_STATUS_LABEL[auftrag.status]}
                        </span>
                      </div>

                      {/* Fahrzeugdaten */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-600 mb-3">
                        {fz?.baujahr && (
                          <div className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            <span>{fz.baujahr}</span>
                          </div>
                        )}
                        {fz?.kilometerstand && (
                          <div className="flex items-center gap-1">
                            <Gauge className="w-3 h-3" />
                            <span>{fz.kilometerstand.toLocaleString('de-DE')} km</span>
                          </div>
                        )}
                        {fz?.farbe && (
                          <div className="flex items-center gap-1">
                            <Palette className="w-3 h-3" />
                            <span>{fz.farbe}</span>
                          </div>
                        )}
                        {fz?.motortyp && (
                          <div className="flex items-center gap-1">
                            <Fuel className="w-3 h-3" />
                            <span>{fz.motortyp}{fz.leistung_kw ? ` · ${fz.leistung_kw} kW` : ''}</span>
                          </div>
                        )}
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
                              {teileKosten > 0 && (
                                <span className="text-gray-400">· {teileKosten.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Kennzeichen + Verkaufspreis */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <span className="text-xs font-mono text-gray-500">
                          {fz?.kennzeichen || 'Kein KZ'}
                        </span>
                        {verkaufspreis && (
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400 leading-none mb-0.5">Verkaufspreis</p>
                            <p className="text-sm font-bold text-purple-700">{verkaufspreis} €</p>
                          </div>
                        )}
                      </div>

                    </div>{/* /p-4 */}
                  </div>
                </Link>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
