'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { dauerMinuten, stundenText } from '@/lib/arbeitszeit'

interface ArbeitszeitDaten {
  zeiten: { userId: string | null; name: string; auftragId: string; start_am: string; ende_am: string | null }[]
  auftraege: Record<string, { nr: string | null; fahrzeug: string; abgerechnetStunden: number }>
}

interface StatistikenProps {
  verkauft: any[]
  werkstatt?: any[]
  lager?: any[]
  arbeitszeit?: ArbeitszeitDaten
}

export function StatistikenContent({ verkauft, werkstatt = [], lager = [], arbeitszeit = { zeiten: [], auftraege: {} } }: StatistikenProps) {
  const [tab, setTab] = useState<'verkauf' | 'werkstatt' | 'lager' | 'zeit'>('verkauf')
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('year')

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const now = new Date()

  // Filter helper
  const filterByPeriod = (items: any[], dateField: string) => {
    return items.filter((item: any) => {
      const date = new Date(item[dateField])
      if (period === 'all') return true
      if (period === 'week') return (now.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000
      if (period === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      if (period === 'year') return date.getFullYear() === now.getFullYear()
      return true
    })
  }

  // ===== VERKAUF TAB =====
  const verkauftFiltered = filterByPeriod(verkauft, 'verkauft_am')
  const verkaufUmsatz = verkauftFiltered.reduce((sum, v) => sum + (v.einnahmen || 0), 0)
  const verkaufGewinn = verkauftFiltered.reduce((sum, v) => {
    // Tatsächlich erzielter Verkaufspreis (einnahmen) hat Vorrang vor dem Inserat-Preis
    const verkaufspreis = v.einnahmen || v.fahrzeug?.verkaufspreis || 0
    const einkaufspreis = v.fahrzeug?.einkaufspreis || 0
    return sum + (verkaufspreis - einkaufspreis)
  }, 0)

  const verkaufWeeklyData = verkauftFiltered.reduce((acc: any, v: any) => {
    const date = new Date(v.verkauft_am)
    const week = Math.ceil((date.getDate()) / 7)
    const weekLabel = `Woche ${week}`
    const existing = acc.find((d: any) => d.week === weekLabel)
    if (existing) {
      existing.umsatz += v.einnahmen || 0
    } else {
      acc.push({ week: weekLabel, umsatz: v.einnahmen || 0 })
    }
    return acc
  }, [])

  const verkaufMarkenData = verkauftFiltered.reduce((acc: any, v: any) => {
    const marke = v.fahrzeug?.marke || 'Unbekannt'
    const existing = acc.find((m: any) => m.marke === marke)
    if (existing) {
      existing.count += 1
    } else {
      acc.push({ marke, count: 1 })
    }
    return acc
  }, [])
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 5)

  // ===== WERKSTATT TAB =====
  // Eine Zeile = eine ausgestellte (nicht stornierte) Rechnung, Beträge netto
  const werkstattFiltered = filterByPeriod(werkstatt, 'datum')
  const werkstattUmsatz = werkstattFiltered.reduce((sum, v) => sum + (v.einnahmen || 0), 0)
  const werkstattKosten = werkstattFiltered.reduce((sum, v) => sum + (v.ersatzteile_kosten || 0), 0)
  const werkstattKostenGeschaetzt = werkstattFiltered.reduce((sum, v) => sum + (v.kosten_geschaetzt || 0), 0)
  const werkstattGewinn = werkstattUmsatz - werkstattKosten

  // ===== LAGER TAB =====
  // Lager kommt als auftraege mit nested fahrzeuge
  const lagerFahrzeuge = lager
    .map((a: any) => a.fahrzeug)
    .filter(Boolean)
  const lagerBestand = lagerFahrzeuge.length
  const lagerWert = lagerFahrzeuge.reduce((sum, v) => sum + (v?.einkaufspreis || 0), 0)
  const lagerOhneEk = lagerFahrzeuge.filter((v) => !v?.einkaufspreis).length
  const verkaufOhneEk = verkauftFiltered.filter((v) => !v.fahrzeug?.einkaufspreis).length
  const lagerDurchschnitt = lagerBestand > 0 ? lagerWert / lagerBestand : 0

  // Render content based on active tab
  const renderVerkauftTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <p className="text-sm text-blue-600 font-medium">Umsatz</p>
            <p className="text-3xl font-bold text-blue-900 mt-2">{formatCurrency(verkaufUmsatz)}</p>
            <p className="text-xs text-blue-600 mt-2">{verkauftFiltered.length} Verkäufe</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <p className="text-sm text-green-600 font-medium">Gewinn</p>
            <p className="text-3xl font-bold text-green-900 mt-2">{formatCurrency(verkaufGewinn)}</p>
            <p className="text-xs text-green-600 mt-2">{verkaufUmsatz > 0 ? ((verkaufGewinn / verkaufUmsatz) * 100).toFixed(1) : 0}% Quote</p>
            {verkaufOhneEk > 0 && (
              <p className="text-xs text-amber-700 mt-1">{verkaufOhneEk} Verkauf{verkaufOhneEk !== 1 ? 'e' : ''} ohne Einkaufspreis (Gewinn dort = voller Verkaufspreis)</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-6">
            <p className="text-sm text-purple-600 font-medium">Durchschnitt pro Auto</p>
            <p className="text-3xl font-bold text-purple-900 mt-2">{formatCurrency(verkauftFiltered.length > 0 ? verkaufGewinn / verkauftFiltered.length : 0)}</p>
            <p className="text-xs text-purple-600 mt-2">Netto-Gewinn</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">📈 Umsatz nach Woche</h3>
            {verkaufWeeklyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={verkaufWeeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="umsatz" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-center py-8">Keine Verkäufe in diesem Zeitraum</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">🏆 Top-Marken</h3>
            {verkaufMarkenData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={verkaufMarkenData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="marke" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-center py-8">Keine Daten verfügbar</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )

  // ===== ARBEITSZEIT TAB =====
  const renderZeitTab = () => {
    const zeiten = filterByPeriod(arbeitszeit.zeiten, 'start_am')
    const jetzt = Date.now()
    const minuten = (z: any) => dauerMinuten(z, jetzt)
    const gesamtMin = zeiten.reduce((s, z) => s + minuten(z), 0)
    // Je Auftrag: gestempelt vs. abgerechnet (abgerechnet nur für Aufträge mit Zeiten im Zeitraum, je Auftrag einmal)
    const jeAuftrag = new Map<string, number>()
    for (const z of zeiten) jeAuftrag.set(z.auftragId, (jeAuftrag.get(z.auftragId) ?? 0) + minuten(z))
    const auftragZeilen = [...jeAuftrag.entries()].map(([id, min]) => {
      const a = arbeitszeit.auftraege[id]
      const abgerechnet = a?.abgerechnetStunden ?? 0
      return { id, nr: a?.nr ?? '—', fahrzeug: a?.fahrzeug ?? '', min, abgerechnet, effizienz: min > 0 && abgerechnet > 0 ? (abgerechnet * 60 / min) * 100 : null }
    }).sort((a, b) => b.min - a.min)
    const abgerechnetGesamt = auftragZeilen.reduce((s, a) => s + a.abgerechnet, 0)
    const stempelMitAbrechnung = auftragZeilen.filter(a => a.abgerechnet > 0).reduce((s, a) => s + a.min, 0)
    const effizienz = stempelMitAbrechnung > 0 ? ((auftragZeilen.filter(a => a.abgerechnet > 0).reduce((s, a) => s + a.abgerechnet, 0) * 60) / stempelMitAbrechnung) * 100 : null
    const jeMitarbeiter = new Map<string, { name: string; min: number; auftraege: Set<string> }>()
    for (const z of zeiten) {
      const key = z.userId ?? 'unbekannt'
      const e = jeMitarbeiter.get(key) ?? { name: z.name, min: 0, auftraege: new Set<string>() }
      e.min += minuten(z); e.auftraege.add(z.auftragId); jeMitarbeiter.set(key, e)
    }
    const farbe = (e: number | null) => e === null ? 'text-slate-400' : e >= 100 ? 'text-green-700' : e >= 80 ? 'text-amber-600' : 'text-red-600'

    if (arbeitszeit.zeiten.length === 0) return (
      <Card><CardContent className="py-12 text-center text-slate-500">
        <p className="text-lg font-medium text-slate-700">Noch keine Arbeitszeiten erfasst</p>
        <p className="text-sm mt-1">Im Auftrag auf „Arbeit starten“ tippen — beim Stoppen wird die Zeit gespeichert und hier ausgewertet.</p>
      </CardContent></Card>
    )
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-2 border-blue-200 bg-blue-50"><CardContent className="p-6">
            <p className="text-sm text-blue-600 font-medium">Gestempelte Stunden</p>
            <p className="text-3xl font-bold text-blue-900 mt-2">{stundenText(gesamtMin)} h</p>
            <p className="text-xs text-blue-600 mt-2">{zeiten.length} Einträge · {jeAuftrag.size} Aufträge</p>
          </CardContent></Card>
          <Card className="border-2 border-purple-200 bg-purple-50"><CardContent className="p-6">
            <p className="text-sm text-purple-600 font-medium">Abgerechnete Arbeitsstunden</p>
            <p className="text-3xl font-bold text-purple-900 mt-2">{abgerechnetGesamt.toLocaleString('de-DE', { maximumFractionDigits: 2 })} h</p>
            <p className="text-xs text-purple-600 mt-2">aus den Werkstattaufträgen dieser Aufträge</p>
          </CardContent></Card>
          <Card className={`border-2 ${effizienz === null ? 'border-slate-200 bg-slate-50' : effizienz >= 100 ? 'border-green-200 bg-green-50' : effizienz >= 80 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}><CardContent className="p-6">
            <p className="text-sm text-slate-600 font-medium">Effizienz</p>
            <p className={`text-3xl font-bold mt-2 ${farbe(effizienz)}`}>{effizienz === null ? '—' : `${effizienz.toFixed(0)} %`}</p>
            <p className="text-xs text-slate-500 mt-2">abgerechnet ÷ gestempelt (nur Aufträge mit Abrechnung)</p>
          </CardContent></Card>
        </div>

        <Card><CardContent className="p-6">
          <h3 className="font-semibold text-slate-900 mb-3">Mitarbeiter</h3>
          <div className="divide-y divide-slate-100">
            {[...jeMitarbeiter.values()].sort((a, b) => b.min - a.min).map(m => (
              <div key={m.name} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-800">{m.name}</span>
                <span className="text-slate-500">{m.auftraege.size} Aufträge · <strong className="text-slate-900">{stundenText(m.min)} h</strong></span>
              </div>
            ))}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-6">
          <h3 className="font-semibold text-slate-900 mb-3">Aufträge mit den meisten Stunden</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-2 pr-3">Auftrag</th><th className="py-2 pr-3 text-right">Gestempelt</th><th className="py-2 pr-3 text-right">Abgerechnet</th><th className="py-2 text-right">Effizienz</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {auftragZeilen.slice(0, 20).map(a => (
                  <tr key={a.id}>
                    <td className="py-2 pr-3"><Link href={`/fahrzeuge/${a.id}#arbeitszeit`} className="text-slate-900 hover:text-orange-600 font-medium">{a.nr}</Link><span className="block text-xs text-slate-400">{a.fahrzeug}</span></td>
                    <td className="py-2 pr-3 text-right tabular-nums">{stundenText(a.min)} h</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{a.abgerechnet > 0 ? `${a.abgerechnet.toLocaleString('de-DE', { maximumFractionDigits: 2 })} h` : '—'}</td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${farbe(a.effizienz)}`}>{a.effizienz === null ? '—' : `${a.effizienz.toFixed(0)} %`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3">100 % oder mehr heißt: schneller gearbeitet, als verkauft. Unter 80 % lohnt ein Blick, ob Arbeit nicht mit abgerechnet wurde.</p>
        </CardContent></Card>
      </div>
    )
  }

  const renderWerkstattTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <p className="text-sm text-blue-600 font-medium">Umsatz (netto)</p>
            <p className="text-3xl font-bold text-blue-900 mt-2">{formatCurrency(werkstattUmsatz)}</p>
            <p className="text-xs text-blue-600 mt-2">{werkstattFiltered.length} Rechnung{werkstattFiltered.length !== 1 ? 'en' : ''}</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <p className="text-sm text-green-600 font-medium">Deckungsbeitrag (netto)</p>
            <p className="text-3xl font-bold text-green-900 mt-2">{formatCurrency(werkstattGewinn)}</p>
            <p className="text-xs text-green-600 mt-2">{werkstattUmsatz > 0 ? ((werkstattGewinn / werkstattUmsatz) * 100).toFixed(1) : 0}% Quote</p>
            <p className="text-xs text-green-700 mt-1">
              Material (Einkauf): {formatCurrency(werkstattKosten)}
              {werkstattKostenGeschaetzt > 0 && ` · davon geschätzt ${formatCurrency(werkstattKostenGeschaetzt)}`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-6">
            <p className="text-sm text-purple-600 font-medium">Durchschnitt pro Rechnung</p>
            <p className="text-3xl font-bold text-purple-900 mt-2">{formatCurrency(werkstattFiltered.length > 0 ? werkstattUmsatz / werkstattFiltered.length : 0)}</p>
            <p className="text-xs text-purple-600 mt-2">Umsatz netto</p>
          </CardContent>
        </Card>
      </div>

      {werkstattFiltered.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-slate-500">Keine Rechnungen in diesem Zeitraum</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6 text-sm text-slate-700 space-y-1">
          <h3 className="font-semibold text-slate-900 mb-2">So wird gerechnet</h3>
          <p><strong>Umsatz</strong> = Summe der Nettobeträge aller ausgestellten Rechnungen (stornierte zählen nicht), nach Rechnungsdatum.</p>
          <p><strong>Material (Einkauf)</strong> = Einkaufspreis (laut Lieferschein) × Menge der Teile, die auf der Rechnung stehen. Teile, die nicht auf der Rechnung erscheinen, zählen nicht. Liegt kein gespeicherter Einkaufspreis vor (Altdaten, von Hand erfasste Teile) oder steht nur ein Festpreis auf der Rechnung, wird der Einkauf als Verkaufspreis ÷ 1,45 geschätzt – diese Anteile sind oben als „geschätzt“ ausgewiesen.</p>
          <p><strong>Betriebsstoffe</strong> (Öl, Wischwasser …) sind im Umsatz enthalten. Ihr Einkauf zählt nur, wenn beim Betriebsstoff ein Einkaufspreis hinterlegt ist; sonst bleibt der Umsatz komplett im Deckungsbeitrag.</p>
          <p><strong>Marge:</strong> Was über dem üblichen Aufschlag liegt, bleibt im Deckungsbeitrag – verglichen wird der abgerechnete Betrag mit dem echten Einkauf.</p>
          <p><strong>Deckungsbeitrag</strong> = Umsatz − Material. Lohn und Kleinteilpauschale haben hier keine Einkaufskosten.</p>
        </CardContent>
      </Card>
    </div>
  )

  const renderLagerTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <p className="text-sm text-blue-600 font-medium">Fahrzeuge im Lager</p>
            <p className="text-3xl font-bold text-blue-900 mt-2">{lagerBestand}</p>
            <p className="text-xs text-blue-600 mt-2">aktueller Bestand</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <p className="text-sm text-green-600 font-medium">Lagerwert</p>
            <p className="text-3xl font-bold text-green-900 mt-2">{formatCurrency(lagerWert)}</p>
            <p className="text-xs text-green-600 mt-2">Gesamteinkaufspreis</p>
            {lagerOhneEk > 0 && (
              <p className="text-xs text-amber-700 mt-1">{lagerOhneEk} von {lagerBestand} Fahrzeugen ohne hinterlegten Einkaufspreis</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-6">
            <p className="text-sm text-purple-600 font-medium">Durchschnittswert</p>
            <p className="text-3xl font-bold text-purple-900 mt-2">{formatCurrency(lagerDurchschnitt)}</p>
            <p className="text-xs text-purple-600 mt-2">pro Fahrzeug</p>
          </CardContent>
        </Card>
      </div>

      {lagerBestand === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-slate-500">Keine Fahrzeuge im Lager</p>
          </CardContent>
        </Card>
      )}
    </div>
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Statistiken</h1>
          <p className="text-slate-600 mt-1">Verkauf • Werkstatt • Lager • Arbeitszeit</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(['verkauf', 'werkstatt', 'lager', 'zeit'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 font-medium transition border-b-2 ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t === 'verkauf' ? '🚗 Verkauf' : t === 'werkstatt' ? '🔧 Werkstatt' : t === 'lager' ? '📦 Lager' : '⏱ Arbeitszeit'}
          </button>
        ))}
      </div>

      {/* Period Filter */}
      <div className="flex gap-2">
        {(['week', 'month', 'year', 'all'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              period === p ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {p === 'week' ? 'Woche' : p === 'month' ? 'Monat' : p === 'year' ? 'Jahr' : 'Alles'}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'verkauf' && renderVerkauftTab()}
      {tab === 'werkstatt' && renderWerkstattTab()}
      {tab === 'lager' && renderLagerTab()}
      {tab === 'zeit' && renderZeitTab()}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Zeitraum-Filter aktiv</h3>
        <p className="text-sm text-blue-800">Die Zeitraumfilter beeinflussen alle KPIs und Charts! Wechsel zwischen den Tabs um verschiedene Bereiche zu analysieren. 📊</p>
      </div>
    </div>
  )
}
