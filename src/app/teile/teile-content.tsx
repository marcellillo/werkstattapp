'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Package, Search, ChevronRight, Car, Truck, CheckCircle2, Archive, Boxes, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import { type TeilStatus, TEIL_STATUS_LABEL, TEIL_STATUS_COLOR } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

type Tab = 'alle' | 'bestellt' | 'auf_lager' | 'verbaut'

const TABS: { value: Tab; label: string; icon: any; description: string }[] = [
  { value: 'alle',      label: 'Alle',              icon: Boxes,        description: 'Komplette Übersicht' },
  { value: 'bestellt',  label: 'Bestellt',           icon: Truck,        description: 'Beim Lieferanten' },
  { value: 'auf_lager', label: 'Auf Lager',          icon: Package,      description: 'Geliefert, noch nicht verbaut' },
  { value: 'verbaut',   label: 'Verbaut',            icon: CheckCircle2, description: 'Eingebaut ins Fahrzeug' },
]

const TEIL_STATUS_ORDER: TeilStatus[] = [
  'nicht_bestellt', 'bestellt', 'unterwegs', 'geliefert', 'eingebaut'
]

function tabMatchesStatus(tab: Tab, status: TeilStatus): boolean {
  if (tab === 'alle') return true
  if (tab === 'bestellt') return status === 'bestellt' || status === 'unterwegs' || status === 'nicht_bestellt'
  if (tab === 'auf_lager') return status === 'geliefert'
  if (tab === 'verbaut') return status === 'eingebaut'
  return true
}

export function TeileContent({ teile: initialTeile }: { teile: any[] }) {
  const [teile, setTeile] = useState(initialTeile)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('alle')
  const supabase = createClient()

  const filtered = teile.filter(t => {
    const matchTab = tabMatchesStatus(tab, t.status as TeilStatus)
    const q = search.toLowerCase()
    const matchSearch = !q ||
      t.bezeichnung?.toLowerCase().includes(q) ||
      t.teilenummer?.toLowerCase().includes(q) ||
      t.lieferant?.toLowerCase().includes(q) ||
      t.auftrag?.fahrzeug?.kennzeichen?.toLowerCase().includes(q) ||
      t.auftrag?.kunde?.nachname?.toLowerCase().includes(q)
    return matchTab && matchSearch
  })

  async function handleStatusChange(id: string, status: TeilStatus) {
    setTeile(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    await supabase.from('ersatzteile').update({ status }).eq('id', id)
  }

  const aufLager   = teile.filter(t => t.status === 'geliefert').length
  const bestellt   = teile.filter(t => ['bestellt','unterwegs','nicht_bestellt'].includes(t.status)).length
  const verbaut    = teile.filter(t => t.status === 'eingebaut').length

  const tabCounts: Record<Tab, number> = {
    alle:      teile.length,
    bestellt,
    auf_lager: aufLager,
    verbaut,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lager</h1>
          <p className="text-sm text-gray-500 mt-0.5">{teile.length} Teile insgesamt</p>
        </div>
        {aufLager > 0 && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
            <Package className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-800">{aufLager} auf Lager</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TABS.map(({ value, label, icon: Icon, description }) => {
          const count = tabCounts[value]
          const active = tab === value
          return (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all',
                active
                  ? value === 'auf_lager'
                    ? 'border-green-500 bg-green-50'
                    : value === 'bestellt'
                    ? 'border-blue-500 bg-blue-50'
                    : value === 'verbaut'
                    ? 'border-gray-400 bg-gray-50'
                    : 'border-orange-500 bg-orange-50'
                  : 'border-gray-100 bg-white hover:border-gray-300'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={cn('w-5 h-5', active
                  ? value === 'auf_lager' ? 'text-green-600'
                  : value === 'bestellt' ? 'text-blue-600'
                  : value === 'verbaut' ? 'text-gray-500'
                  : 'text-orange-600'
                  : 'text-gray-400'
                )} />
                <span className={cn('text-2xl font-bold', active ? 'text-gray-900' : 'text-gray-700')}>
                  {count}
                </span>
              </div>
              <p className={cn('text-sm font-semibold', active ? 'text-gray-900' : 'text-gray-600')}>{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            </button>
          )
        })}
      </div>

      {/* Lager-Hinweis */}
      {tab === 'auf_lager' && aufLager === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700">Kein Teil liegt unverbaut auf Lager — alles verbaut oder noch unterwegs.</p>
        </div>
      )}
      {tab === 'auf_lager' && aufLager > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-semibold">{aufLager} {aufLager === 1 ? 'Teil liegt' : 'Teile liegen'}</span> geliefert auf Lager und {aufLager === 1 ? 'wurde' : 'wurden'} noch nicht verbaut.
          </p>
        </div>
      )}

      {/* Suche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Bezeichnung, Teilenummer, Lieferant, Kennzeichen..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Keine Teile in dieser Kategorie</p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Teil</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Fahrzeug</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Lieferant</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden xl:table-cell">Menge / Preis</th>
                  <th className="w-8 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(teil => (
                  <tr key={teil.id} className={cn(
                    'hover:bg-gray-50/50 transition-colors',
                    teil.status === 'geliefert' && tab === 'auf_lager' && 'bg-green-50/30'
                  )}>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-900 text-sm">{teil.bezeichnung}</p>
                      {teil.teilenummer && (
                        <p className="text-xs text-gray-400 font-mono">{teil.teilenummer}</p>
                      )}
                      {teil.bestellt_am && (
                        <p className="text-xs text-gray-400 mt-0.5">Bestellt: {formatDate(teil.bestellt_am)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      {teil.auftrag?.fahrzeug ? (
                        <Link href={`/fahrzeuge/${teil.auftrag_id}`} className="flex items-center gap-2 hover:text-orange-600 group">
                          <Car className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-700">{teil.auftrag.fahrzeug.marke} {teil.auftrag.fahrzeug.modell}</p>
                            <p className="text-xs text-gray-400 font-mono">{teil.auftrag.fahrzeug.kennzeichen}</p>
                          </div>
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-sm text-gray-600">{teil.lieferant ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={teil.status}
                        onChange={e => handleStatusChange(teil.id, e.target.value as TeilStatus)}
                        className={cn(
                          'text-xs px-2.5 py-1.5 rounded-full border font-medium focus:outline-none cursor-pointer',
                          TEIL_STATUS_COLOR[teil.status as TeilStatus]
                        )}
                      >
                        {TEIL_STATUS_ORDER.map(s => (
                          <option key={s} value={s}>{TEIL_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3.5 hidden xl:table-cell">
                      <span className="text-sm text-gray-600">
                        {teil.menge}×
                        {teil.einzelpreis != null && ` · ${(teil.einzelpreis * teil.menge).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {teil.auftrag_id && (
                        <Link href={`/fahrzeuge/${teil.auftrag_id}`}>
                          <ChevronRight className="w-4 h-4 text-gray-300 hover:text-orange-500" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
