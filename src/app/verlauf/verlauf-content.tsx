'use client'
import { useState } from 'react'
import Link from 'next/link'
import { History, Search, Car, User, Package, ShieldCheck, ChevronRight, ChevronDown, Wrench, Phone, Building } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'

const TUEV_CFG: Record<string, { label: string; color: string }> = {
  bestanden: { label: 'TÜV Bestanden', color: 'bg-green-100 text-green-700 border-green-200' },
  nicht_bestanden: { label: 'TÜV Nicht bestanden', color: 'bg-red-100 text-red-700 border-red-200' },
  maengel: { label: 'TÜV Mit Mängeln', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
}

export function VerlaufContent({ auftraege }: { auftraege: any[] }) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = auftraege.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.fahrzeug?.kennzeichen?.toLowerCase().includes(q) ||
      a.fahrzeug?.marke?.toLowerCase().includes(q) ||
      a.fahrzeug?.modell?.toLowerCase().includes(q) ||
      a.kunde?.vorname?.toLowerCase().includes(q) ||
      a.kunde?.nachname?.toLowerCase().includes(q) ||
      a.kunde?.firma?.toLowerCase().includes(q) ||
      a.arbeiten?.toLowerCase().includes(q)
    )
  })

  const totalTeile = auftraege.reduce((sum, a) => sum + (a.ersatzteile?.length ?? 0), 0)
  const totalUmsatz = auftraege.reduce((sum, a) => {
    return sum + (a.ersatzteile ?? []).reduce((s: number, t: any) => s + ((t.preis ?? 0) * (t.menge ?? 1)), 0)
  }, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verlauf</h1>
        <p className="text-sm text-gray-500 mt-0.5">Alle abgeschlossenen Aufträge</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 mb-1">Aufträge gesamt</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{auftraege.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 mb-1">Teile verbaut</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalTeile}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 mb-1">Teile-Einkauf</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalUmsatz)}
          </p>
        </CardContent></Card>
      </div>

      {/* Suche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Kennzeichen, Fahrzeug, Kunde, Arbeiten..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">Noch keine abgeschlossenen Aufträge</p>
          <p className="text-sm text-gray-400 mt-1">Aufträge erscheinen hier sobald sie auf "Ausgeliefert" gesetzt werden.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const teile: any[] = a.ersatzteile ?? []
            const isOpen = expanded === a.id
            const eigen = a.fahrzeug?.fahrzeug_typ === 'eigen'
            const teileWert = teile.reduce((s: number, t: any) => s + ((t.preis ?? 0) * (t.menge ?? 1)), 0)

            return (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-orange-200 transition-colors">
                {/* Header Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : a.id)}
                >
                  {/* Datum */}
                  <div className="flex-shrink-0 w-12 text-center">
                    <p className="text-base font-bold text-gray-900 leading-none">
                      {new Date(a.created_at).getDate().toString().padStart(2, '0')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.created_at).toLocaleDateString('de-DE', { month: 'short' })}
                    </p>
                    <p className="text-xs text-gray-300">
                      {new Date(a.created_at).getFullYear()}
                    </p>
                  </div>

                  {/* Fahrzeug */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">
                        {a.fahrzeug?.marke} {a.fahrzeug?.modell}
                      </p>
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {a.fahrzeug?.kennzeichen}
                      </span>
                      {eigen && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Eigen</span>}
                      {a.tuev_kandidat && a.tuev_ergebnis && (
                        <span className={cn('text-xs px-1.5 py-0.5 rounded border', TUEV_CFG[a.tuev_ergebnis]?.color)}>
                          {TUEV_CFG[a.tuev_ergebnis]?.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {a.kunde && (
                        <span className="text-xs text-gray-500 flex items-center gap-0.5">
                          <User className="w-3 h-3" />
                          {a.kunde.firma || `${a.kunde.vorname} ${a.kunde.nachname}`}
                        </span>
                      )}
                      {teile.length > 0 && (
                        <span className="text-xs text-gray-500 flex items-center gap-0.5">
                          <Package className="w-3 h-3" />{teile.length} Teil{teile.length !== 1 ? 'e' : ''}
                        </span>
                      )}
                      {teileWert > 0 && (
                        <span className="text-xs text-gray-500">
                          {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(teileWert)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href={`/fahrzeuge/${a.id}`} onClick={e => e.stopPropagation()} className="text-gray-300 hover:text-orange-500 p-1">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-200" />}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/50 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Kunde */}
                      {a.kunde && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Kunde</p>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {a.kunde.vorname} {a.kunde.nachname}
                              </p>
                              {a.kunde.firma && (
                                <p className="text-xs text-gray-500 flex items-center gap-0.5">
                                  <Building className="w-3 h-3" />{a.kunde.firma}
                                </p>
                              )}
                              {a.kunde.telefon && (
                                <p className="text-xs text-gray-500 flex items-center gap-0.5">
                                  <Phone className="w-3 h-3" />{a.kunde.telefon}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Fahrzeug-Details */}
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Fahrzeug</p>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Car className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{a.fahrzeug?.marke} {a.fahrzeug?.modell}</p>
                            <p className="text-xs text-gray-500 font-mono">{a.fahrzeug?.kennzeichen}</p>
                            {a.fahrzeug?.baujahr && <p className="text-xs text-gray-400">Baujahr {a.fahrzeug.baujahr}</p>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Arbeiten */}
                    {a.arbeiten && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Durchgeführte Arbeiten</p>
                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                          {a.arbeiten.split('\n').filter(Boolean).map((l: string, i: number) => (
                            <p key={i} className="text-sm text-gray-700 flex items-start gap-2">
                              <Wrench className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />{l}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ersatzteile */}
                    {teile.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                          Verbaute Teile ({teile.length})
                          {teileWert > 0 && <span className="ml-2 normal-case font-normal text-gray-500">
                            Einkaufswert: {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(teileWert)}
                          </span>}
                        </p>
                        <div className="space-y-1.5">
                          {teile.map((t: any) => (
                            <div key={t.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                              <div className="flex items-center gap-2 min-w-0">
                                <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-sm text-gray-800 truncate">{t.bezeichnung}</span>
                                {t.teilenummer && <span className="text-xs text-gray-400 font-mono hidden sm:inline">{t.teilenummer}</span>}
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                {t.menge && t.menge > 1 && <span className="text-xs text-gray-500">×{t.menge}</span>}
                                {t.preis && (
                                  <span className="text-xs font-medium text-gray-700">
                                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(t.preis * (t.menge ?? 1))}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
