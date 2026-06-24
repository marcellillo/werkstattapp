'use client'
import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Euro, Receipt, Download, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Auftrag = {
  id: string
  auftrag_nr: string
  einnahmen: number
  erstellt_am: string
  status: string
  fahrzeug: { kennzeichen: string; marke: string; modell: string } | null
}

type Ausgabe = {
  id: string
  gesamt: number | null
  datum: string | null
  bezahlt: boolean
  lieferant: string | null
  rechnungsnummer: string | null
  faellig_am: string | null
}

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtEuro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export function BuchhaltungContent({ auftraege, ausgaben, kleinunternehmer, firmaName }: {
  auftraege: Auftrag[]
  ausgaben: Ausgabe[]
  kleinunternehmer: boolean
  firmaName: string
}) {
  const [tab, setTab] = useState<'uebersicht' | 'einnahmen' | 'ausgaben'>('uebersicht')
  const [jahr, setJahr] = useState(new Date().getFullYear())
  const [expandedMonat, setExpandedMonat] = useState<number | null>(null)

  const mwstSatz = kleinunternehmer ? 0 : 0.19

  // Einnahmen nach Jahr/Monat gruppieren
  const einnahmenNetto = useMemo(() => auftraege.map(a => ({
    ...a,
    netto: kleinunternehmer ? a.einnahmen : a.einnahmen / 1.19,
    brutto: a.einnahmen,
    mwst: kleinunternehmer ? 0 : a.einnahmen - a.einnahmen / 1.19,
    monat: new Date(a.erstellt_am).getMonth(),
    monatJahr: new Date(a.erstellt_am).getFullYear(),
  })), [auftraege, kleinunternehmer])

  const ausgabenMitDatum = useMemo(() => ausgaben.map(a => ({
    ...a,
    monat: a.datum ? new Date(a.datum).getMonth() : -1,
    monatJahr: a.datum ? new Date(a.datum).getFullYear() : -1,
  })), [ausgaben])

  const jahresDaten = useMemo(() => {
    const einJahr = einnahmenNetto.filter(a => a.monatJahr === jahr)
    const ausJahr = ausgabenMitDatum.filter(a => a.monatJahr === jahr)

    return Array.from({ length: 12 }, (_, m) => {
      const einM = einJahr.filter(a => a.monat === m)
      const ausM = ausJahr.filter(a => a.monat === m)
      const einSumme = einM.reduce((s, a) => s + a.netto, 0)
      const aussSumme = ausM.reduce((s, a) => s + (a.gesamt ?? 0), 0)
      return {
        monat: m,
        einnahmen: einSumme,
        ausgaben: aussSumme,
        gewinn: einSumme - aussSumme,
        einnahmenBrutto: einM.reduce((s, a) => s + a.brutto, 0),
        mwst: einM.reduce((s, a) => s + a.mwst, 0),
        auftraege: einM,
        rechnungen: ausM,
      }
    })
  }, [einnahmenNetto, ausgabenMitDatum, jahr])

  const gesamtEinnahmen = jahresDaten.reduce((s, m) => s + m.einnahmen, 0)
  const gesamtAusgaben = jahresDaten.reduce((s, m) => s + m.ausgaben, 0)
  const gesamtGewinn = gesamtEinnahmen - gesamtAusgaben
  const gesamtMwst = jahresDaten.reduce((s, m) => s + m.mwst, 0)
  const offeneAusgaben = ausgaben.filter(a => !a.bezahlt).reduce((s, a) => s + (a.gesamt ?? 0), 0)

  const jahre = useMemo(() => {
    const set = new Set<number>()
    auftraege.forEach(a => set.add(new Date(a.erstellt_am).getFullYear()))
    ausgaben.forEach(a => { if (a.datum) set.add(new Date(a.datum).getFullYear()) })
    set.add(new Date().getFullYear())
    return Array.from(set).sort((a, b) => b - a)
  }, [auftraege, ausgaben])

  function exportCSV() {
    const zeilen = [
      ['Monat', 'Einnahmen (netto)', 'Ausgaben', 'Gewinn', 'MwSt'],
      ...jahresDaten.map(m => [
        `${MONATE[m.monat]} ${jahr}`,
        m.einnahmen.toFixed(2),
        m.ausgaben.toFixed(2),
        m.gewinn.toFixed(2),
        m.mwst.toFixed(2),
      ]),
      ['Gesamt', gesamtEinnahmen.toFixed(2), gesamtAusgaben.toFixed(2), gesamtGewinn.toFixed(2), gesamtMwst.toFixed(2)],
    ]
    const csv = zeilen.map(z => z.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `buchhaltung-${jahr}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const maxWert = Math.max(...jahresDaten.map(m => Math.max(m.einnahmen, m.ausgaben)), 1)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Buchhaltung</h1>
          <p className="text-sm text-slate-500 mt-0.5">{firmaName || 'Finanzübersicht'}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={jahr} onChange={e => setJahr(+e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700">
            {jahre.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-400 transition-colors">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Einnahmen netto</p>
              <ArrowUpRight className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600 stat-number">{fmtEuro(gesamtEinnahmen)}</p>
            {!kleinunternehmer && <p className="text-xs text-slate-400 mt-0.5">brutto {fmtEuro(gesamtEinnahmen + gesamtMwst)}</p>}
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Ausgaben</p>
              <ArrowDownRight className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-2xl font-bold text-red-500 stat-number">{fmtEuro(gesamtAusgaben)}</p>
            {offeneAusgaben > 0 && <p className="text-xs text-amber-500 mt-0.5">{fmtEuro(offeneAusgaben)} offen</p>}
          </CardContent>
        </Card>
        <Card className={cn('card-hover', gesamtGewinn < 0 && 'border-red-200')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Gewinn</p>
              {gesamtGewinn >= 0
                ? <TrendingUp className="w-4 h-4 text-green-500" />
                : <TrendingDown className="w-4 h-4 text-red-500" />}
            </div>
            <p className={cn('text-2xl font-bold stat-number', gesamtGewinn >= 0 ? 'text-slate-900' : 'text-red-600')}>
              {fmtEuro(gesamtGewinn)}
            </p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                {kleinunternehmer ? 'Kleinunternehmer' : 'MwSt (19%)'}
              </p>
              <Euro className="w-4 h-4 text-slate-400" />
            </div>
            {kleinunternehmer
              ? <p className="text-sm text-slate-500 mt-2">Keine MwSt-Pflicht</p>
              : <p className="text-2xl font-bold text-slate-900 stat-number">{fmtEuro(gesamtMwst)}</p>
            }
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(['uebersicht', 'einnahmen', 'ausgaben'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            )}>
            {t === 'uebersicht' ? 'Übersicht' : t === 'einnahmen' ? 'Einnahmen' : 'Ausgaben'}
          </button>
        ))}
      </div>

      {/* Übersicht — Monatsbalken */}
      {tab === 'uebersicht' && (
        <div className="space-y-2">
          {jahresDaten.map(m => {
            const hatDaten = m.einnahmen > 0 || m.ausgaben > 0
            const open = expandedMonat === m.monat
            return (
              <div key={m.monat} className={cn('bg-white border rounded-xl overflow-hidden transition-all',
                !hatDaten ? 'opacity-40' : 'border-slate-200'
              )}>
                <button
                  onClick={() => hatDaten && setExpandedMonat(open ? null : m.monat)}
                  className="w-full px-4 py-3 flex items-center gap-4 text-left"
                  disabled={!hatDaten}
                >
                  <span className="w-8 text-xs font-semibold text-slate-500">{MONATE[m.monat]}</span>

                  {/* Balken */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-green-100 flex-1">
                        <div className="h-2 rounded-full bg-green-500 transition-all"
                          style={{ width: `${(m.einnahmen / maxWert) * 100}%` }} />
                      </div>
                      <span className="text-xs text-green-600 w-24 text-right font-medium">{m.einnahmen > 0 ? fmtEuro(m.einnahmen) : '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-red-100 flex-1">
                        <div className="h-2 rounded-full bg-red-400 transition-all"
                          style={{ width: `${(m.ausgaben / maxWert) * 100}%` }} />
                      </div>
                      <span className="text-xs text-red-500 w-24 text-right font-medium">{m.ausgaben > 0 ? fmtEuro(m.ausgaben) : '—'}</span>
                    </div>
                  </div>

                  <div className={cn('text-xs font-bold w-20 text-right', m.gewinn >= 0 ? 'text-slate-700' : 'text-red-600')}>
                    {hatDaten ? (m.gewinn >= 0 ? '+' : '') + fmtEuro(m.gewinn) : ''}
                  </div>
                  {hatDaten && (open ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />)}
                </button>

                {open && (
                  <div className="border-t border-slate-100 grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                    <div className="p-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5 text-green-500" /> Einnahmen ({m.auftraege.length})
                      </p>
                      {m.auftraege.length === 0
                        ? <p className="text-xs text-slate-400">Keine</p>
                        : m.auftraege.map(a => (
                          <div key={a.id} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
                            <div>
                              <p className="text-xs font-medium text-slate-700">{a.fahrzeug?.kennzeichen ?? a.auftrag_nr}</p>
                              <p className="text-xs text-slate-400">{a.fahrzeug ? `${a.fahrzeug.marke} ${a.fahrzeug.modell}` : ''}</p>
                            </div>
                            <p className="text-xs font-semibold text-green-600">{fmtEuro(a.netto)}</p>
                          </div>
                        ))
                      }
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <ArrowDownRight className="w-3.5 h-3.5 text-red-400" /> Ausgaben ({m.rechnungen.length})
                      </p>
                      {m.rechnungen.length === 0
                        ? <p className="text-xs text-slate-400">Keine</p>
                        : m.rechnungen.map(r => (
                          <div key={r.id} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
                            <div>
                              <p className="text-xs font-medium text-slate-700">{r.lieferant ?? 'Unbekannt'}</p>
                              <p className="text-xs text-slate-400">{r.rechnungsnummer ?? fmt(r.datum)}</p>
                            </div>
                            <p className={cn('text-xs font-semibold', r.bezahlt ? 'text-slate-500' : 'text-red-500')}>
                              {fmtEuro(r.gesamt ?? 0)}
                            </p>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Einnahmen-Tab */}
      {tab === 'einnahmen' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Fahrzeug</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Datum</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Netto</th>
                {!kleinunternehmer && <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">MwSt</th>}
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Brutto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {einnahmenNetto.filter(a => a.monatJahr === jahr).map(a => (
                <tr key={a.id} className="row-interactive">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-800">{a.fahrzeug?.kennzeichen ?? a.auftrag_nr}</p>
                    <p className="text-xs text-slate-400">{a.fahrzeug ? `${a.fahrzeug.marke} ${a.fahrzeug.modell}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 hidden sm:table-cell">{fmt(a.erstellt_am)}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{fmtEuro(a.netto)}</td>
                  {!kleinunternehmer && <td className="px-4 py-3 text-right text-sm text-slate-400 hidden sm:table-cell">{fmtEuro(a.mwst)}</td>}
                  <td className="px-5 py-3 text-right text-sm font-semibold text-green-600">{fmtEuro(a.brutto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={kleinunternehmer ? 2 : 3} className="px-5 py-3 text-sm font-semibold text-slate-700">Gesamt {jahr}</td>
                {!kleinunternehmer && <td className="px-4 py-3 text-right text-sm font-semibold text-slate-500 hidden sm:table-cell">{fmtEuro(gesamtMwst)}</td>}
                <td className="px-5 py-3 text-right text-sm font-bold text-green-600">{fmtEuro(gesamtEinnahmen + gesamtMwst)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Ausgaben-Tab */}
      {tab === 'ausgaben' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Lieferant</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Datum</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Fällig</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Betrag</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ausgabenMitDatum.filter(a => a.monatJahr === jahr).map(a => (
                <tr key={a.id} className="row-interactive">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-800">{a.lieferant ?? 'Unbekannt'}</p>
                    <p className="text-xs text-slate-400 font-mono">{a.rechnungsnummer ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 hidden sm:table-cell">{fmt(a.datum)}</td>
                  <td className="px-4 py-3 text-sm hidden sm:table-cell">
                    <span className={cn(!a.bezahlt && a.faellig_am && a.faellig_am < new Date().toISOString().split('T')[0] ? 'text-red-600 font-medium' : 'text-slate-400')}>
                      {fmt(a.faellig_am)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-slate-800">{fmtEuro(a.gesamt ?? 0)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      a.bezahlt ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {a.bezahlt ? 'Bezahlt' : 'Offen'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-slate-700">Gesamt {jahr}</td>
                <td className="px-5 py-3 text-right text-sm font-bold text-red-500">{fmtEuro(gesamtAusgaben)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
