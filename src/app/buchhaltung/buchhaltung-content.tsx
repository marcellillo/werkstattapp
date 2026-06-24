'use client'
import { useState, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Euro, Download,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Eye, EyeOff
} from 'lucide-react'
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

const MONATE_KURZ  = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const MONATE_LANG  = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtEuro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function sign(n: number) { return n >= 0 ? '+' : '' }

export function BuchhaltungContent({ auftraege, ausgaben, kleinunternehmer, firmaName }: {
  auftraege: Auftrag[]
  ausgaben: Ausgabe[]
  kleinunternehmer: boolean
  firmaName: string
}) {
  const [jahr, setJahr] = useState(new Date().getFullYear())
  const [expandedMonat, setExpandedMonat] = useState<number | null>(null)
  const [leereMonate, setLeereMonate] = useState(false)
  const heute = new Date().toISOString().split('T')[0]

  const einnahmenNetto = useMemo(() => auftraege.map(a => ({
    ...a,
    netto:  kleinunternehmer ? a.einnahmen : a.einnahmen / 1.19,
    brutto: a.einnahmen,
    mwst:   kleinunternehmer ? 0 : a.einnahmen - a.einnahmen / 1.19,
    monat:      new Date(a.erstellt_am).getMonth(),
    monatJahr:  new Date(a.erstellt_am).getFullYear(),
  })), [auftraege, kleinunternehmer])

  const ausgabenMitDatum = useMemo(() => ausgaben.map(a => ({
    ...a,
    monat:     a.datum ? new Date(a.datum).getMonth() : -1,
    monatJahr: a.datum ? new Date(a.datum).getFullYear() : -1,
  })), [ausgaben])

  const jahresDaten = useMemo(() => {
    const einJahr = einnahmenNetto.filter(a => a.monatJahr === jahr)
    const ausJahr = ausgabenMitDatum.filter(a => a.monatJahr === jahr)
    return Array.from({ length: 12 }, (_, m) => {
      const einM = einJahr.filter(a => a.monat === m)
      const ausM = ausJahr.filter(a => a.monat === m)
      const einSumme  = einM.reduce((s, a) => s + a.netto, 0)
      const aussSumme = ausM.reduce((s, a) => s + (a.gesamt ?? 0), 0)
      return {
        monat: m,
        einnahmen: einSumme,
        ausgaben:  aussSumme,
        gewinn:    einSumme - aussSumme,
        brutto:    einM.reduce((s, a) => s + a.brutto, 0),
        mwst:      einM.reduce((s, a) => s + a.mwst, 0),
        auftraege: einM,
        rechnungen: ausM,
        hatDaten: einM.length > 0 || ausM.length > 0,
      }
    })
  }, [einnahmenNetto, ausgabenMitDatum, jahr])

  const gesamtEin   = jahresDaten.reduce((s, m) => s + m.einnahmen, 0)
  const gesamtAus   = jahresDaten.reduce((s, m) => s + m.ausgaben, 0)
  const gesamtGew   = gesamtEin - gesamtAus
  const gesamtMwst  = jahresDaten.reduce((s, m) => s + m.mwst, 0)
  const offenAus    = ausgaben.filter(a => !a.bezahlt).reduce((s, a) => s + (a.gesamt ?? 0), 0)
  const maxWert     = Math.max(...jahresDaten.map(m => Math.max(m.einnahmen, m.ausgaben)), 1)

  const jahre = useMemo(() => {
    const set = new Set<number>()
    auftraege.forEach(a => set.add(new Date(a.erstellt_am).getFullYear()))
    ausgaben.forEach(a => { if (a.datum) set.add(new Date(a.datum).getFullYear()) })
    set.add(new Date().getFullYear())
    return Array.from(set).sort((a, b) => b - a)
  }, [auftraege, ausgaben])

  function exportCSV() {
    const zeilen = [
      ['Monat','Einnahmen netto','MwSt','Ausgaben','Gewinn'],
      ...jahresDaten.map(m => [
        `${MONATE_LANG[m.monat]} ${jahr}`,
        m.einnahmen.toFixed(2), m.mwst.toFixed(2),
        m.ausgaben.toFixed(2),  m.gewinn.toFixed(2),
      ]),
      ['Gesamt', gesamtEin.toFixed(2), gesamtMwst.toFixed(2), gesamtAus.toFixed(2), gesamtGew.toFixed(2)],
    ]
    const csv = zeilen.map(z => z.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `buchhaltung-${jahr}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const sichtbareMonate = leereMonate
    ? jahresDaten
    : jahresDaten.filter(m => m.hatDaten)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Buchhaltung</h1>
          <p className="text-sm text-slate-500 mt-0.5">{firmaName || 'Finanzübersicht'}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={jahr} onChange={e => setJahr(+e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 font-medium">
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
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Einnahmen</p>
              <ArrowUpRight className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-xl font-bold text-green-600 stat-number">{fmtEuro(gesamtEin)}</p>
            <p className="text-xs text-slate-400 mt-1">netto</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Ausgaben</p>
              <ArrowDownRight className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-xl font-bold text-red-500 stat-number">{fmtEuro(gesamtAus)}</p>
            {offenAus > 0
              ? <p className="text-xs text-amber-500 mt-1">{fmtEuro(offenAus)} offen</p>
              : <p className="text-xs text-slate-400 mt-1">alles bezahlt</p>
            }
          </CardContent>
        </Card>
        <Card className={cn('card-hover', gesamtGew < 0 && 'border-red-200 bg-red-50/30')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Gewinn</p>
              {gesamtGew >= 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
            </div>
            <p className={cn('text-xl font-bold stat-number', gesamtGew >= 0 ? 'text-slate-900' : 'text-red-600')}>
              {fmtEuro(gesamtGew)}
            </p>
            <p className="text-xs text-slate-400 mt-1">vor Steuer</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                {kleinunternehmer ? 'MwSt' : 'MwSt 19%'}
              </p>
              <Euro className="w-4 h-4 text-slate-400" />
            </div>
            {kleinunternehmer
              ? <p className="text-sm text-slate-400 mt-2 font-medium">Kleinunternehmer</p>
              : <>
                  <p className="text-xl font-bold text-slate-900 stat-number">{fmtEuro(gesamtMwst)}</p>
                  <p className="text-xs text-slate-400 mt-1">abzuführen</p>
                </>
            }
          </CardContent>
        </Card>
      </div>

      {/* Monatsübersicht */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Monatsübersicht {jahr}</h2>
        <button onClick={() => setLeereMonate(v => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
          {leereMonate ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {leereMonate ? 'Leere ausblenden' : 'Leere anzeigen'}
        </button>
      </div>

      {sichtbareMonate.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400 text-sm">
          Keine Daten für {jahr}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Spaltenkopf */}
          <div className="hidden sm:grid grid-cols-[80px_1fr_100px_100px_100px_28px] gap-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <span>Monat</span>
            <span>Verlauf</span>
            <span className="text-right text-green-500">Einnahmen</span>
            <span className="text-right text-red-400">Ausgaben</span>
            <span className="text-right">Gewinn</span>
            <span />
          </div>

          {sichtbareMonate.map(m => {
            const open = expandedMonat === m.monat
            return (
              <div key={m.monat} className={cn(
                'bg-white border rounded-xl overflow-hidden transition-all',
                open ? 'border-orange-300 shadow-sm' : m.hatDaten ? 'border-slate-200' : 'border-slate-100 opacity-50'
              )}>
                {/* Hauptzeile */}
                <button
                  disabled={!m.hatDaten}
                  onClick={() => setExpandedMonat(open ? null : m.monat)}
                  className="w-full grid grid-cols-[80px_1fr] sm:grid-cols-[80px_1fr_100px_100px_100px_28px] gap-3 items-center px-4 py-3 text-left hover:bg-slate-50/50 transition-colors disabled:cursor-default"
                >
                  {/* Monat */}
                  <div>
                    <p className="text-sm font-bold text-slate-800">{MONATE_KURZ[m.monat]}</p>
                    {m.hatDaten && (
                      <p className="text-xs text-slate-400">{m.auftraege.length + m.rechnungen.length} Vorgänge</p>
                    )}
                  </div>

                  {/* Balken */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-green-50 flex-1 min-w-0">
                        <div className="h-1.5 rounded-full bg-green-400 transition-all duration-500"
                          style={{ width: `${(m.einnahmen / maxWert) * 100}%` }} />
                      </div>
                      <span className="text-xs text-green-600 font-medium sm:hidden w-20 text-right shrink-0">
                        {m.einnahmen > 0 ? fmtEuro(m.einnahmen) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-red-50 flex-1 min-w-0">
                        <div className="h-1.5 rounded-full bg-red-400 transition-all duration-500"
                          style={{ width: `${(m.ausgaben / maxWert) * 100}%` }} />
                      </div>
                      <span className="text-xs text-red-500 font-medium sm:hidden w-20 text-right shrink-0">
                        {m.ausgaben > 0 ? fmtEuro(m.ausgaben) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Zahlen (Desktop) */}
                  <p className="text-sm font-semibold text-green-600 text-right hidden sm:block">
                    {m.einnahmen > 0 ? fmtEuro(m.einnahmen) : '—'}
                  </p>
                  <p className="text-sm font-semibold text-red-500 text-right hidden sm:block">
                    {m.ausgaben > 0 ? fmtEuro(m.ausgaben) : '—'}
                  </p>
                  <p className={cn('text-sm font-bold text-right hidden sm:block',
                    m.gewinn > 0 ? 'text-slate-800' : m.gewinn < 0 ? 'text-red-600' : 'text-slate-400'
                  )}>
                    {m.hatDaten ? sign(m.gewinn) + fmtEuro(m.gewinn) : '—'}
                  </p>

                  {m.hatDaten && (open
                    ? <ChevronUp className="w-4 h-4 text-slate-400 hidden sm:block" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
                  )}
                </button>

                {/* Detail-Klappsection */}
                {open && (
                  <div className="border-t border-slate-100">
                    {/* Zusammenfassung */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/60">
                      {[
                        { label: 'Einnahmen netto', val: fmtEuro(m.einnahmen), color: 'text-green-600' },
                        { label: 'Ausgaben', val: fmtEuro(m.ausgaben), color: 'text-red-500' },
                        { label: 'Gewinn', val: sign(m.gewinn) + fmtEuro(m.gewinn), color: m.gewinn >= 0 ? 'text-slate-800' : 'text-red-600' },
                        { label: kleinunternehmer ? 'MwSt' : 'MwSt 19%', val: kleinunternehmer ? '—' : fmtEuro(m.mwst), color: 'text-slate-600' },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="px-4 py-3">
                          <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                          <p className={cn('text-sm font-bold', color)}>{val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Einnahmen & Ausgaben nebeneinander */}
                    <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">

                      {/* Einnahmen */}
                      <div className="p-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <ArrowUpRight className="w-3.5 h-3.5 text-green-500" />
                          Einnahmen · {m.auftraege.length} Aufträge
                        </p>
                        {m.auftraege.length === 0 ? (
                          <p className="text-xs text-slate-300 italic">Keine Einnahmen</p>
                        ) : (
                          <div className="space-y-2">
                            {m.auftraege.map(a => (
                              <div key={a.id} className="flex items-center justify-between gap-2 py-2 border-b border-slate-50 last:border-0">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-700 truncate">
                                    {a.fahrzeug?.kennzeichen ?? a.auftrag_nr}
                                  </p>
                                  <p className="text-xs text-slate-400 truncate">
                                    {a.fahrzeug ? `${a.fahrzeug.marke} ${a.fahrzeug.modell}` : ''}
                                    {' · '}{fmt(a.erstellt_am)}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xs font-bold text-green-600">{fmtEuro(a.netto)}</p>
                                  {!kleinunternehmer && <p className="text-xs text-slate-400">+{fmtEuro(a.mwst)} MwSt</p>}
                                </div>
                              </div>
                            ))}
                            <div className="flex justify-between pt-2 border-t border-slate-200">
                              <p className="text-xs font-semibold text-slate-500">Summe netto</p>
                              <p className="text-xs font-bold text-green-600">{fmtEuro(m.einnahmen)}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Ausgaben */}
                      <div className="p-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                          Ausgaben · {m.rechnungen.length} Rechnungen
                        </p>
                        {m.rechnungen.length === 0 ? (
                          <p className="text-xs text-slate-300 italic">Keine Ausgaben</p>
                        ) : (
                          <div className="space-y-2">
                            {m.rechnungen.map(r => {
                              const ueberfaellig = !r.bezahlt && r.faellig_am && r.faellig_am < heute
                              return (
                                <div key={r.id} className="flex items-center justify-between gap-2 py-2 border-b border-slate-50 last:border-0">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-700 truncate">{r.lieferant ?? 'Unbekannt'}</p>
                                    <p className="text-xs text-slate-400 font-mono truncate">{r.rechnungsnummer ?? fmt(r.datum)}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-xs font-bold text-slate-800">{fmtEuro(r.gesamt ?? 0)}</p>
                                    <span className={cn('text-xs font-medium',
                                      r.bezahlt ? 'text-green-500' : ueberfaellig ? 'text-red-500' : 'text-amber-500'
                                    )}>
                                      {r.bezahlt ? '✓ Bezahlt' : ueberfaellig ? '⚠ Überfällig' : '· Offen'}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                            <div className="flex justify-between pt-2 border-t border-slate-200">
                              <p className="text-xs font-semibold text-slate-500">Summe</p>
                              <p className="text-xs font-bold text-red-500">{fmtEuro(m.ausgaben)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Jahreszeile */}
          <div className="grid grid-cols-[80px_1fr_100px_100px_100px_28px] gap-3 items-center px-4 py-3 bg-slate-900 rounded-xl text-white mt-2">
            <p className="text-sm font-bold">Gesamt</p>
            <div />
            <p className="text-sm font-bold text-green-400 text-right">{fmtEuro(gesamtEin)}</p>
            <p className="text-sm font-bold text-red-400 text-right">{fmtEuro(gesamtAus)}</p>
            <p className={cn('text-sm font-bold text-right', gesamtGew >= 0 ? 'text-white' : 'text-red-400')}>
              {sign(gesamtGew)}{fmtEuro(gesamtGew)}
            </p>
            <div />
          </div>
        </div>
      )}
    </div>
  )
}
