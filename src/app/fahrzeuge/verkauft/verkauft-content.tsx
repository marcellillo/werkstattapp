'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Car, ChevronDown, Download, User, Calendar, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { berechneFahrzeugSteuer, STEUERART_KURZ, STEUERART_COLOR, type Steuerart } from '@/lib/fahrzeug-steuer'
import { createRechnungOnAusgeliefert } from '@/lib/auto-rechnung-ersteller'

type VerkauftEintrag = {
  id: string
  status: string
  verkauft_am: string | null
  auslieferung_geplant: string | null
  einnahmen: number | null
  bemerkungen: string | null
  kaeufer_name: string | null
  steuerart: Steuerart | null
  fahrzeug: {
    id: string
    marke: string
    modell: string
    kennzeichen: string
    mobile_de_id: string | null
    verkaufspreis: number | null
    einkaufspreis: number | null
  } | null
}

// Lokales, bearbeitbares Zeilenmodell
type Row = {
  auftragId: string
  fahrzeugId: string | null
  name: string
  bnr: string | null
  status: string
  verkauftAm: string | null
  vk: number | null
  ek: number | null
  steuerart: Steuerart
  kaeufer: string | null
}

function toRow(e: VerkauftEintrag, standard: Steuerart): Row {
  return {
    auftragId: e.id,
    fahrzeugId: e.fahrzeug?.id ?? null,
    name: `${e.fahrzeug?.marke ?? ''} ${e.fahrzeug?.modell ?? ''}`.trim() || 'Fahrzeug',
    bnr: e.fahrzeug?.mobile_de_id ?? e.fahrzeug?.kennzeichen ?? null,
    status: e.status,
    verkauftAm: e.verkauft_am,
    vk: e.einnahmen ?? e.fahrzeug?.verkaufspreis ?? null,
    ek: e.fahrzeug?.einkaufspreis ?? null,
    steuerart: e.steuerart ?? standard,
    kaeufer: e.kaeufer_name ?? e.bemerkungen?.match(/Käufer:\s*(.+)/)?.[1]?.trim() ?? null,
  }
}

const fmtEuro = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const fmtDatum = (d: string | null) => d ? new Date(d).toLocaleDateString('de-DE') : '—'

export function VerkauftContent({ verkauft, standardSteuerart = 'differenz', isArchiv = false }: { verkauft: VerkauftEintrag[]; standardSteuerart?: Steuerart; isArchiv?: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(() => verkauft.map(e => toRow(e, standardSteuerart)))
  const [offeneJahre, setOffeneJahre] = useState<Set<number>>(() => new Set([new Date().getFullYear()]))
  const [uebergebenId, setUebergebenId] = useState<string | null>(null)
  const [uebergebenLoading, setUebergebenLoading] = useState(false)

  function toggleJahr(jahr: number) {
    setOffeneJahre(prev => {
      const next = new Set(prev)
      next.has(jahr) ? next.delete(jahr) : next.add(jahr)
      return next
    })
  }

  // Lokal aktualisieren + in DB speichern
  function updateRow(auftragId: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => r.auftragId === auftragId ? { ...r, ...patch } : r))
  }
  async function saveVk(r: Row, wert: string) {
    const vk = wert.trim() ? parseFloat(wert.replace(',', '.')) : null
    updateRow(r.auftragId, { vk })
    await supabase.from('auftraege').update({ einnahmen: vk }).eq('id', r.auftragId)
  }
  async function saveEk(r: Row, wert: string) {
    const ek = wert.trim() ? parseFloat(wert.replace(',', '.')) : null
    updateRow(r.auftragId, { ek })
    if (r.fahrzeugId) await supabase.from('fahrzeuge').update({ einkaufspreis: ek }).eq('id', r.fahrzeugId)
  }
  async function saveSteuerart(r: Row, art: Steuerart) {
    updateRow(r.auftragId, { steuerart: art })
    await supabase.from('auftraege').update({ steuerart: art }).eq('id', r.auftragId)
  }

  async function handleUebergeben(auftragId: string) {
    if (!auftragId) return
    setUebergebenLoading(true)
    try {
      // Rechnung erstellen (für Eigenfahrzeuge automatisch)
      const rechnungResult = await createRechnungOnAusgeliefert(auftragId)
      console.log('Rechnung erstellt:', rechnungResult)

      // Status auf ausgeliefert setzen
      const { error } = await supabase
        .from('auftraege')
        .update({ status: 'ausgeliefert' })
        .eq('id', auftragId)

      if (error) {
        console.error('Fehler beim Status-Update:', error)
      } else {
        setUebergebenId(null)
        setTimeout(() => window.location.reload(), 500)
      }
    } catch (err) {
      console.error('Fehler bei Übergeben:', err)
    } finally {
      setUebergebenLoading(false)
    }
  }

  // Nach Jahr gruppieren
  const jahre = useMemo(() => {
    const map = new Map<number, Row[]>()
    for (const r of rows) {
      const j = r.verkauftAm ? parseInt(r.verkauftAm.slice(0, 4)) : 0
      if (!map.has(j)) map.set(j, [])
      map.get(j)!.push(r)
    }
    for (const list of map.values()) list.sort((a, b) => (b.verkauftAm ?? '').localeCompare(a.verkauftAm ?? ''))
    return [...map.entries()].sort((a, b) => b[0] - a[0])
  }, [rows])

  function summe(list: Row[]) {
    return list.reduce((acc, r) => {
      const s = berechneFahrzeugSteuer({ verkaufspreis: r.vk, einkaufspreis: r.ek, steuerart: r.steuerart })
      acc.vk += r.vk ?? 0
      acc.ek += r.ek ?? 0
      acc.marge += s.marge
      acc.mwst += s.mwst
      acc.gewinn += s.marge - s.mwst
      return acc
    }, { vk: 0, ek: 0, marge: 0, mwst: 0, gewinn: 0 })
  }
  const gesamt = summe(rows)
  const unklassifiziert = rows.filter(r => r.ek == null).length

  function exportCSV() {
    const zeilen: string[][] = [['Verkauft am', 'Fahrzeug', 'B-Nr', 'Käufer', 'Einkauf', 'Verkauf', 'Marge', 'Steuerart', 'MwSt', 'Gewinn']]
    for (const [jahr, list] of jahre) {
      for (const r of list) {
        const s = berechneFahrzeugSteuer({ verkaufspreis: r.vk, einkaufspreis: r.ek, steuerart: r.steuerart })
        zeilen.push([
          fmtDatum(r.verkauftAm), r.name, r.bnr ?? '', r.kaeufer ?? '',
          (r.ek ?? 0).toFixed(2), (r.vk ?? 0).toFixed(2), s.marge.toFixed(2),
          STEUERART_KURZ[r.steuerart], s.mwst.toFixed(2), (s.marge - s.mwst).toFixed(2),
        ])
      }
    }
    zeilen.push(['GESAMT', '', '', '', gesamt.ek.toFixed(2), gesamt.vk.toFixed(2), gesamt.marge.toFixed(2), '', gesamt.mwst.toFixed(2), gesamt.gewinn.toFixed(2)])
    const csv = zeilen.map(z => z.map(c => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `steuerblatt-fahrzeuge.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link href="/fahrzeuge?tab=eigen" className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Steuerblatt Fahrzeuge</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{rows.length} verkauft · EK/VK eintragen</p>
          </div>
        </div>
        {rows.length > 0 && (
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0">
            <Download className="w-4 h-4" /> CSV
          </button>
        )}
      </div>

      {/* Summen-Karten */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <div className="bg-white border border-gray-200 rounded-lg md:rounded-xl p-3 md:p-4">
            <p className="text-xs text-gray-500 mb-1">Verkaufserlös</p>
            <p className="text-lg md:text-xl font-bold text-gray-900 truncate">{fmtEuro(gesamt.vk)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg md:rounded-xl p-3 md:p-4">
            <p className="text-xs text-gray-500 mb-1">Einkauf</p>
            <p className="text-lg md:text-xl font-bold text-gray-500 truncate">{fmtEuro(gesamt.ek)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg md:rounded-xl p-3 md:p-4">
            <p className="text-xs text-gray-500 mb-1">MwSt</p>
            <p className="text-lg md:text-xl font-bold text-amber-600 truncate">{fmtEuro(gesamt.mwst)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg md:rounded-xl p-3 md:p-4">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Gewinn</p>
            <p className={cn('text-lg md:text-xl font-bold truncate', gesamt.gewinn >= 0 ? 'text-green-600' : 'text-red-600')}>{fmtEuro(gesamt.gewinn)}</p>
          </div>
        </div>
      )}

      {unklassifiziert > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm text-amber-800">
          Bei <strong>{unklassifiziert}</strong> {unklassifiziert === 1 ? 'Fahrzeug' : 'Fahrzeugen'} fehlt der Einkaufspreis — bitte eintragen.
        </div>
      )}

      {/* Leer-State */}
      {rows.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
          <Car className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500 font-medium">Noch keine Fahrzeuge verkauft</p>
          <Link href="/fahrzeuge?tab=eigen" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors">
            Zum Lagerbestand
          </Link>
        </div>
      )}

      {/* Jahres-Gruppen als Steuerblatt-Tabellen */}
      {jahre.map(([jahr, list]) => {
        const offen = offeneJahre.has(jahr)
        const jSum = summe(list)
        return (
          <div key={jahr} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggleJahr(jahr)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <ChevronDown className={cn('w-5 h-5 text-gray-400 transition-transform', !offen && '-rotate-90')} />
                <span className="text-lg font-bold text-gray-900">{jahr === 0 ? 'Kein Datum' : jahr}</span>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{list.length}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="hidden sm:inline text-amber-600 font-medium">MwSt {fmtEuro(jSum.mwst)}</span>
                <span className={cn('font-bold', jSum.gewinn >= 0 ? 'text-green-700' : 'text-red-600')}>{fmtEuro(jSum.gewinn)}</span>
              </div>
            </button>

            {offen && (
              <div className="border-t border-gray-100">
                {/* Desktop: Tabelle */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-2.5">Fahrzeug</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">Verkauft</th>
                        <th className="px-3 py-2.5 text-right">Einkauf €</th>
                        <th className="px-3 py-2.5 text-right">Verkauf €</th>
                        <th className="px-3 py-2.5 text-right">Marge</th>
                        <th className="px-3 py-2.5 text-center">Steuerart</th>
                        <th className="px-3 py-2.5 text-right">MwSt</th>
                        <th className="px-3 py-2.5 text-right">Gewinn</th>
                        {!isArchiv && <th className="px-3 py-2.5 text-center">Aktion</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {list.map(r => {
                        const s = berechneFahrzeugSteuer({ verkaufspreis: r.vk, einkaufspreis: r.ek, steuerart: r.steuerart })
                        const gewinn = s.marge - s.mwst
                        return (
                          <tr key={r.auftragId} className="hover:bg-gray-50/60">
                            <td className="px-4 py-2.5">
                              <Link href={`/fahrzeuge/${r.auftragId}`} className="font-medium text-gray-900 hover:text-purple-700">{r.name}</Link>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                {r.bnr && <span className="font-mono text-purple-500">{r.bnr}</span>}
                                {r.status === 'verkauft' && <span className="text-orange-500">⏳ n. übergeben</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDatum(r.verkauftAm)}</td>
                            <td className="px-3 py-2.5">
                              <input
                                type="number" inputMode="decimal" defaultValue={r.ek ?? ''}
                                onBlur={e => { if ((e.target.value ? parseFloat(e.target.value) : null) !== r.ek) saveEk(r, e.target.value) }}
                                placeholder="—"
                                className="w-24 text-right border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                type="number" inputMode="decimal" defaultValue={r.vk ?? ''}
                                onBlur={e => { if ((e.target.value ? parseFloat(e.target.value) : null) !== r.vk) saveVk(r, e.target.value) }}
                                placeholder="—"
                                className="w-24 text-right border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-gray-700 whitespace-nowrap">{fmtEuro(s.marge)}</td>
                            <td className="px-3 py-2.5 text-center">
                              <select
                                value={r.steuerart}
                                onChange={e => saveSteuerart(r, e.target.value as Steuerart)}
                                className={cn('text-xs font-medium border rounded-md px-1.5 py-1 cursor-pointer focus:outline-none', STEUERART_COLOR[r.steuerart])}
                              >
                                <option value="differenz">§25a</option>
                                <option value="regel">19%</option>
                                <option value="ausfuhr">Ausfuhr</option>
                              </select>
                            </td>
                            <td className="px-3 py-2.5 text-right text-amber-600 whitespace-nowrap">{fmtEuro(s.mwst)}</td>
                            <td className={cn('px-3 py-2.5 text-right font-semibold whitespace-nowrap', gewinn >= 0 ? 'text-green-600' : 'text-red-600')}>{fmtEuro(gewinn)}</td>
                            {!isArchiv && r.status === 'verkauft' && (
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  onClick={() => setUebergebenId(r.auftragId)}
                                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-md transition-colors whitespace-nowrap"
                                  disabled={uebergebenLoading}
                                >
                                  Übergeben
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold text-gray-800 border-t border-gray-200">
                        <td className="px-4 py-2.5" colSpan={2}>Summe {jahr === 0 ? '' : jahr}</td>
                        <td className="px-3 py-2.5 text-right">{fmtEuro(jSum.ek)}</td>
                        <td className="px-3 py-2.5 text-right">{fmtEuro(jSum.vk)}</td>
                        <td className="px-3 py-2.5 text-right">{fmtEuro(jSum.marge)}</td>
                        <td></td>
                        <td className="px-3 py-2.5 text-right text-amber-600">{fmtEuro(jSum.mwst)}</td>
                        <td className={cn('px-3 py-2.5 text-right', jSum.gewinn >= 0 ? 'text-green-700' : 'text-red-600')}>{fmtEuro(jSum.gewinn)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile: Card-Liste */}
                <div className="md:hidden space-y-3 p-4">
                  {list.map(r => {
                    const s = berechneFahrzeugSteuer({ verkaufspreis: r.vk, einkaufspreis: r.ek, steuerart: r.steuerart })
                    const gewinn = s.marge - s.mwst
                    return (
                      <div key={r.auftragId} className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                        {/* Fahrzeug-Info */}
                        <div>
                          <Link href={`/fahrzeuge/${r.auftragId}`} className="block font-semibold text-gray-900 hover:text-purple-600">{r.name}</Link>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            {r.bnr && <span className="font-mono text-purple-600">{r.bnr}</span>}
                            <span>{fmtDatum(r.verkauftAm)}</span>
                            {r.status === 'verkauft' && <span className="text-orange-500 font-medium">⏳ n. übergeben</span>}
                          </div>
                        </div>

                        {/* Preise & Steuern */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600 text-xs mb-1">Einkauf</p>
                            <input
                              type="number" inputMode="decimal" defaultValue={r.ek ?? ''}
                              onBlur={e => { if ((e.target.value ? parseFloat(e.target.value) : null) !== r.ek) saveEk(r, e.target.value) }}
                              placeholder="—"
                              className="w-full text-right border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                          </div>
                          <div>
                            <p className="text-gray-600 text-xs mb-1">Verkauf</p>
                            <input
                              type="number" inputMode="decimal" defaultValue={r.vk ?? ''}
                              onBlur={e => { if ((e.target.value ? parseFloat(e.target.value) : null) !== r.vk) saveVk(r, e.target.value) }}
                              placeholder="—"
                              className="w-full text-right border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                          </div>
                        </div>

                        {/* Steuerart & Berechnung */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600 text-xs mb-1">Steuerart</p>
                            <select
                              value={r.steuerart}
                              onChange={e => saveSteuerart(r, e.target.value as Steuerart)}
                              className={cn('w-full text-xs font-medium border rounded px-2 py-1.5 cursor-pointer focus:outline-none', STEUERART_COLOR[r.steuerart])}
                            >
                              <option value="differenz">§25a</option>
                              <option value="regel">19%</option>
                              <option value="ausfuhr">Ausfuhr</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-gray-600 text-xs mb-1">Marge</p>
                            <div className="px-2 py-1.5 font-medium text-gray-900">{fmtEuro(s.marge)}</div>
                          </div>
                        </div>

                        {/* Steuern */}
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-300">
                          <span className="text-gray-600">MwSt</span>
                          <span className="text-amber-600 font-medium">{fmtEuro(s.mwst)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Gewinn</span>
                          <span className={cn('font-semibold', gewinn >= 0 ? 'text-green-600' : 'text-red-600')}>{fmtEuro(gewinn)}</span>
                        </div>

                        {/* Übergeben-Button */}
                        {!isArchiv && r.status === 'verkauft' && (
                          <button
                            onClick={() => setUebergebenId(r.auftragId)}
                            className="w-full mt-3 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                            disabled={uebergebenLoading}
                          >
                            {uebergebenLoading && uebergebenId === r.auftragId ? 'Lädt...' : 'Übergeben'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {/* Summen-Card */}
                  <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-2 mt-4">
                    <h3 className="font-semibold text-gray-900">Summe {jahr === 0 ? '' : jahr}</h3>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-gray-600">EK:</span> <span className="font-medium">{fmtEuro(jSum.ek)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">VK:</span> <span className="font-medium">{fmtEuro(jSum.vk)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Marge:</span> <span className="font-medium">{fmtEuro(jSum.marge)}</span></div>
                      <div className="flex justify-between pt-1 border-t border-gray-200"><span className="text-gray-600">MwSt:</span> <span className="font-medium text-amber-600">{fmtEuro(jSum.mwst)}</span></div>
                      <div className={cn('flex justify-between', jSum.gewinn >= 0 ? 'text-green-700' : 'text-red-600')}><span>Gewinn:</span> <span className="font-semibold">{fmtEuro(jSum.gewinn)}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <p className="text-xs text-gray-400 px-1">
        Hinweis: §25a = Differenzbesteuerung (MwSt nur auf die Marge), 19% = Regelbesteuerung, Ausfuhr = steuerfrei.
        Angaben ohne Gewähr — bitte mit dem Steuerberater abstimmen.
      </p>

      {/* Übergeben-Bestätigung Modal */}
      {uebergebenId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Fahrzeug übergeben?</h2>
            <p className="text-sm text-gray-500 mb-4">
              Das Auto wird aus der Verkaufsverwaltung in die Übergabe-Archiv verschoben. Status: verkauft → ausgeliefert.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setUebergebenId(null)}
                disabled={uebergebenLoading}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleUebergeben(uebergebenId)}
                disabled={uebergebenLoading}
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {uebergebenLoading ? 'Lädt...' : 'Übergeben'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
