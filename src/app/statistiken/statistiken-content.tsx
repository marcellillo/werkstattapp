'use client'
import { Car, Package, Clock, TrendingUp, CheckCircle, Wrench, Receipt, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { FAHRZEUG_STATUS_LABEL, FAHRZEUG_STATUS_COLOR, type FahrzeugStatus, TEIL_STATUS_LABEL, type TeilStatus } from '@/types/database'

const STATUS_COLORS: Record<string, string> = {
  angenommen:   '#94a3b8',
  diagnose:     '#60a5fa',
  reparatur:    '#fb923c',
  warten_teile: '#fbbf24',
  fertig:       '#34d399',
  ausgeliefert: '#a78bfa',
}

const TEIL_COLORS: Record<string, string> = {
  nicht_bestellt: '#f87171',
  bestellt:       '#fb923c',
  unterwegs:      '#fbbf24',
  geliefert:      '#34d399',
  eingebaut:      '#10b981',
}

const PALETTE = ['#ea580c', '#f97316', '#fb923c', '#fed7aa', '#1e40af', '#3b82f6', '#93c5fd']

type Props = {
  auftraege: any[]
  teile: any[]
  rechnungen: any[]
  hebebuehnen: any[]
}

function getLast6Months() {
  const months: { key: string; label: string }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
    })
  }
  return months
}

export function StatistikenContent({ auftraege, teile, rechnungen, hebebuehnen }: Props) {
  const months = getLast6Months()

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const fertige = auftraege.filter(a => ['fertig', 'ausgeliefert'].includes(a.status))
  const offene  = auftraege.filter(a => !['fertig', 'ausgeliefert'].includes(a.status))
  const gesamtEinnahmen = auftraege.reduce((s, a) => s + (a.einnahmen ?? 0), 0)
  const gesamtEinkauf   = rechnungen.reduce((s, r) => s + (r.gesamt ?? 0), 0)
  const offeneTeile = teile.filter(t => ['nicht_bestellt', 'bestellt', 'unterwegs'].includes(t.status)).length
  const tuevBestanden = auftraege.filter(a => a.tuev_ergebnis === 'bestanden').length
  const tuevGesamt    = auftraege.filter(a => a.tuev_ergebnis).length

  // ── Aufträge pro Monat ──────────────────────────────────────────────────────
  const auftragProMonat = months.map(m => {
    const abgeschlossen = auftraege.filter(a => {
      const d = a.fertiggestellt_am ?? a.erstellt_am
      return d && d.startsWith(m.key)
    }).length
    const neu = auftraege.filter(a => a.erstellt_am?.startsWith(m.key)).length
    return { monat: m.label, Abgeschlossen: abgeschlossen, Neu: neu }
  })

  // ── Einnahmen pro Monat ──────────────────────────────────────────────────────
  const einnahmenProMonat = months.map(m => {
    const summe = auftraege
      .filter(a => (a.fertiggestellt_am ?? a.erstellt_am)?.startsWith(m.key))
      .reduce((s, a) => s + (a.einnahmen ?? 0), 0)
    return { monat: m.label, Einnahmen: Math.round(summe) }
  })

  // ── Einkauf pro Monat ────────────────────────────────────────────────────────
  const einkaufProMonat = months.map(m => {
    const summe = rechnungen
      .filter(r => r.datum?.startsWith(m.key))
      .reduce((s, r) => s + (r.gesamt ?? 0), 0)
    return { monat: m.label, Einkauf: Math.round(summe) }
  })

  // ── Auftragsstatus ──────────────────────────────────────────────────────────
  const statusCounts: Record<string, number> = {}
  for (const a of auftraege) statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1
  const statusPie = Object.entries(statusCounts).map(([s, v]) => ({
    name: FAHRZEUG_STATUS_LABEL[s as FahrzeugStatus] ?? s,
    value: v,
    color: STATUS_COLORS[s] ?? '#94a3b8',
  }))

  // ── Teile-Status ────────────────────────────────────────────────────────────
  const teilStatusCounts: Record<string, number> = {}
  for (const t of teile) teilStatusCounts[t.status] = (teilStatusCounts[t.status] ?? 0) + 1

  // ── Top Lieferanten (nach Einkaufswert) ─────────────────────────────────────
  const lieferantenMap: Record<string, number> = {}
  for (const r of rechnungen) {
    if (r.lieferant) lieferantenMap[r.lieferant] = (lieferantenMap[r.lieferant] ?? 0) + (r.gesamt ?? 0)
  }
  const topLieferanten = Object.entries(lieferantenMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, wert]) => ({ name, Einkauf: Math.round(wert) }))

  // ── Hebebühnen-Auslastung ───────────────────────────────────────────────────
  const buehnenAuslastung = hebebuehnen.map(b => {
    const belegt = auftraege.filter(a => a.hebebuehne_id === b.id && !['fertig', 'ausgeliefert'].includes(a.status)).length
    return { name: b.bezeichnung ?? `Bühne ${b.nummer}`, Belegt: belegt }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statistiken</h1>
        <p className="text-sm text-gray-500 mt-0.5">Werkstattkennzahlen auf einen Blick</p>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[
          { label: 'Aufträge gesamt',    value: auftraege.length,               icon: Car,          color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Abgeschlossen',      value: fertige.length,                 icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Offen / in Arbeit',  value: offene.length,                  icon: Wrench,       color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Wartende Teile',     value: offeneTeile,                    icon: Package,      color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Einnahmen gesamt',   value: `${gesamtEinnahmen.toFixed(0)} €`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Einkauf gesamt',     value: `${gesamtEinkauf.toFixed(0)} €`,  icon: Receipt,    color: 'text-red-600',    bg: 'bg-red-50' },
          { label: 'TÜV bestanden',      value: tuevGesamt > 0 ? `${tuevBestanden}/${tuevGesamt}` : '—', icon: ShieldCheck, color: 'text-teal-600', bg: 'bg-teal-50' },
          { label: 'Rechnungen',         value: rechnungen.length,              icon: Receipt,      color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Aufträge + Einnahmen pro Monat */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Car className="w-4 h-4 text-orange-500" /> Aufträge pro Monat (letzte 6 Monate)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={auftragProMonat} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Neu" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Abgeschlossen" fill="#ea580c" radius={[3, 3, 0, 0]} />
                <Legend iconSize={8} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Einnahmen pro Monat (€)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={einnahmenProMonat} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`${v} €`, 'Einnahmen']} />
                <Line type="monotone" dataKey="Einnahmen" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Status-Verteilung + Einkauf pro Monat */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-orange-500" /> Auftragsstatus aktuell
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusPie.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-gray-300 text-sm">Keine Daten</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend iconSize={9} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-red-500" /> Einkauf pro Monat (€)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={einkaufProMonat} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`${v} €`, 'Einkauf']} />
                <Bar dataKey="Einkauf" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Lieferanten */}
      {topLieferanten.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-500" /> Top Lieferanten nach Einkaufswert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topLieferanten} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v} €`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(v: any) => [`${v} €`, 'Einkauf']} />
                <Bar dataKey="Einkauf" radius={[0, 3, 3, 0]}>
                  {topLieferanten.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Ersatzteile Status + Hebebühnen */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-yellow-500" /> Ersatzteile nach Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {(['nicht_bestellt', 'bestellt', 'unterwegs', 'geliefert', 'eingebaut'] as TeilStatus[]).map(s => {
                const count = teilStatusCounts[s] ?? 0
                return (
                  <div key={s} className="text-center p-3 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: TEIL_COLORS[s] + '20', color: TEIL_COLORS[s] }}>
                      {TEIL_STATUS_LABEL[s]}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" /> Hebebühnen-Auslastung (aktive Aufträge)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {buehnenAuslastung.length === 0 ? (
              <div className="h-[160px] flex items-center justify-center text-gray-300 text-sm">Keine Hebebühnen</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={buehnenAuslastung} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="Belegt" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
