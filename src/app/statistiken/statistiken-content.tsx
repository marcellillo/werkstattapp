'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface StatistikenProps {
  verkauft: any[]
  werkstatt?: any[]
  lager?: any[]
}

export function StatistikenContent({ verkauft, werkstatt = [], lager = [] }: StatistikenProps) {
  const [tab, setTab] = useState<'verkauf' | 'werkstatt' | 'lager'>('verkauf')
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month')

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
    const verkaufspreis = v.fahrzeug?.verkaufspreis || v.einnahmen || 0
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
  const werkstattFiltered = filterByPeriod(werkstatt, 'fertiggestellt_am')
  const werkstattUmsatz = werkstattFiltered.reduce((sum, v) => sum + (v.einnahmen || 0), 0)
  const werkstattGewinn = werkstattFiltered.reduce((sum, v) => {
    const einnahmen = v.einnahmen || 0
    const kosten = v.ersatzteile_kosten || 0
    return sum + (einnahmen - kosten)
  }, 0)

  // ===== LAGER TAB =====
  const lagerBestand = lager.length
  const lagerWert = lager.reduce((sum, v) => sum + (v.einkaufspreis || 0), 0)
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

  const renderWerkstattTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <p className="text-sm text-blue-600 font-medium">Umsatz</p>
            <p className="text-3xl font-bold text-blue-900 mt-2">{formatCurrency(werkstattUmsatz)}</p>
            <p className="text-xs text-blue-600 mt-2">{werkstattFiltered.length} Aufträge</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <p className="text-sm text-green-600 font-medium">Deckungsbeitrag</p>
            <p className="text-3xl font-bold text-green-900 mt-2">{formatCurrency(werkstattGewinn)}</p>
            <p className="text-xs text-green-600 mt-2">{werkstattUmsatz > 0 ? ((werkstattGewinn / werkstattUmsatz) * 100).toFixed(1) : 0}% Quote</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-6">
            <p className="text-sm text-purple-600 font-medium">Durchschnitt pro Auftrag</p>
            <p className="text-3xl font-bold text-purple-900 mt-2">{formatCurrency(werkstattFiltered.length > 0 ? werkstattUmsatz / werkstattFiltered.length : 0)}</p>
            <p className="text-xs text-purple-600 mt-2">Umsatz</p>
          </CardContent>
        </Card>
      </div>

      {werkstattFiltered.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-slate-500">Keine abgeschlossenen Werkstatt-Aufträge in diesem Zeitraum</p>
          </CardContent>
        </Card>
      )}
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
          <p className="text-slate-600 mt-1">Verkauf • Werkstatt • Lager</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(['verkauf', 'werkstatt', 'lager'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 font-medium transition border-b-2 ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t === 'verkauf' ? '🚗 Verkauf' : t === 'werkstatt' ? '🔧 Werkstatt' : '📦 Lager'}
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Zeitraum-Filter aktiv</h3>
        <p className="text-sm text-blue-800">Die Zeitraumfilter beeinflussen alle KPIs und Charts! Wechsel zwischen den Tabs um verschiedene Bereiche zu analysieren. 📊</p>
      </div>
    </div>
  )
}
