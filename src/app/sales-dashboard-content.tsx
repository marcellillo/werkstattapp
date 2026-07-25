'use client'

import { Car, TrendingUp, DollarSign, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  color: 'blue' | 'green' | 'purple' | 'orange'
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  }

  return (
    <Card className={`border-2 ${colors[color]}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium opacity-75">{label}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
          </div>
          <div className="text-4xl opacity-50">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SalesDashboardContent({
  bestand,
  verkauft,
  umsatzData,
}: {
  bestand: number
  verkauft: any[]
  umsatzData: any[]
}) {
  // Berechne KPIs
  const umsatz = verkauft.reduce((sum, a) => sum + (a.einnahmen || 0), 0)
  const gewinn = verkauft.reduce((sum, a) => {
    const verkaufspreis = a.fahrzeug?.verkaufspreis || a.einnahmen || 0
    const einkaufspreis = a.fahrzeug?.einkaufspreis || 0
    return sum + (verkaufspreis - einkaufspreis)
  }, 0)
  const verkauftCount = verkauft.length
  const gewinnProAuto = verkauftCount > 0 ? gewinn / verkauftCount : 0

  // Formatierung
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const monat = new Date().toLocaleString('de-DE', { month: 'long', year: 'numeric' })

  // Chart-Daten: Umsatz nach Woche
  const weeklyData = verkauft.reduce((acc: any, v: any) => {
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

  // Chart-Daten: Top-Marken
  const markenData = verkauft.reduce((acc: any, v: any) => {
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Sales Dashboard</h1>
        <p className="text-slate-600 mt-1">Übersicht für {monat}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Fahrzeuge im Bestand"
          value={bestand}
          icon={<Car className="w-8 h-8" />}
          color="blue"
        />
        <StatCard
          label="Verkaufte Autos"
          value={verkauftCount}
          icon={<TrendingUp className="w-8 h-8" />}
          color="green"
        />
        <StatCard
          label="Umsatz (Brutto)"
          value={formatCurrency(umsatz)}
          icon={<DollarSign className="w-8 h-8" />}
          color="purple"
        />
        <StatCard
          label="Gewinn (Netto)"
          value={formatCurrency(gewinn)}
          icon={<Calendar className="w-8 h-8" />}
          color="orange"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Umsatz nach Woche */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">📈 Umsatz nach Woche</h3>
            {weeklyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="umsatz" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-center py-8">Keine Verkäufe diesen Monat</p>
            )}
          </CardContent>
        </Card>

        {/* Top-Marken */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">🏆 Top-Marken</h3>
            {markenData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={markenData}>
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

      {/* Zusätz-Info */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-600">Durchschnitt pro Auto</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(gewinnProAuto)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Umsatz pro Auto</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(verkauftCount > 0 ? umsatz / verkauftCount : 0)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Gewinne-Quote</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{umsatz > 0 ? ((gewinn / umsatz) * 100).toFixed(1) : 0}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
