'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Package, Search, ChevronRight, Car } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import {
  type TeilStatus,
  TEIL_STATUS_LABEL, TEIL_STATUS_COLOR,
} from '@/types/database'
import { createClient } from '@/lib/supabase/client'

const TEIL_STATUS_ORDER: TeilStatus[] = [
  'nicht_bestellt', 'bestellt', 'unterwegs', 'geliefert', 'eingebaut'
]

const FILTER_STATUS: { label: string; value: TeilStatus | 'alle' }[] = [
  { label: 'Alle', value: 'alle' },
  { label: 'Nicht bestellt', value: 'nicht_bestellt' },
  { label: 'Bestellt', value: 'bestellt' },
  { label: 'Unterwegs', value: 'unterwegs' },
  { label: 'Geliefert', value: 'geliefert' },
  { label: 'Eingebaut', value: 'eingebaut' },
]

export function TeileContent({ teile: initialTeile }: { teile: any[] }) {
  const [teile, setTeile] = useState(initialTeile)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TeilStatus | 'alle'>('alle')
  const supabase = createClient()

  const filtered = teile.filter(t => {
    const matchStatus = statusFilter === 'alle' || t.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      t.bezeichnung?.toLowerCase().includes(q) ||
      t.teilenummer?.toLowerCase().includes(q) ||
      t.lieferant?.toLowerCase().includes(q) ||
      t.auftrag?.fahrzeug?.kennzeichen?.toLowerCase().includes(q) ||
      t.auftrag?.kunde?.nachname?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  async function handleStatusChange(id: string, status: TeilStatus) {
    setTeile(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    await supabase.from('ersatzteile').update({ status }).eq('id', id)
  }

  // Summary counts
  const counts: Record<string, number> = {}
  for (const s of TEIL_STATUS_ORDER) {
    counts[s] = teile.filter(t => t.status === s).length
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ersatzteile</h1>
        <p className="text-sm text-gray-800 mt-0.5">{teile.length} Teile insgesamt</p>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {TEIL_STATUS_ORDER.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(prev => prev === s ? 'alle' : s)}
            className={cn(
              'p-3 rounded-xl border-2 text-left transition-all',
              statusFilter === s ? 'border-gray-900 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-300'
            )}
          >
            <p className="text-2xl font-bold text-gray-900">{counts[s]}</p>
            <span className={cn(
              'inline-flex px-2 py-0.5 rounded-full text-xs border font-medium mt-1',
              TEIL_STATUS_COLOR[s]
            )}>
              {TEIL_STATUS_LABEL[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Bezeichnung, Teilenummer, Lieferant, Kennzeichen..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-800">Keine Teile gefunden</p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Teil</th>
                  <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Fahrzeug</th>
                  <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Lieferant</th>
                  <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3 hidden xl:table-cell">Menge / Preis</th>
                  <th className="w-8 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(teil => (
                  <tr key={teil.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-900 text-sm">{teil.bezeichnung}</p>
                      {teil.teilenummer && (
                        <p className="text-xs text-gray-600 font-mono">{teil.teilenummer}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      {teil.auftrag?.fahrzeug ? (
                        <Link href={`/fahrzeuge/${teil.auftrag_id}`} className="flex items-center gap-2 hover:text-orange-600 group">
                          <Car className="w-3.5 h-3.5 text-gray-600 group-hover:text-orange-500" />
                          <div>
                            <p className="text-sm text-gray-700">
                              {teil.auftrag.fahrzeug.marke} {teil.auftrag.fahrzeug.modell}
                            </p>
                            <p className="text-xs text-gray-600 font-mono">{teil.auftrag.fahrzeug.kennzeichen}</p>
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
                        {teil.menge}x
                        {teil.einzelpreis && ` · ${(teil.einzelpreis * teil.menge).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link href={`/fahrzeuge/${teil.auftrag_id}`}>
                        <ChevronRight className="w-4 h-4 text-gray-300 hover:text-orange-500" />
                      </Link>
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

