'use client'
import { Car, Package, Clock, TrendingUp, CheckCircle, Wrench, Receipt, ShieldCheck, Warehouse, Truck, Euro, AlertCircle } from 'lucide-react'
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

  // Werkstattleistungen vs. Fahrzeugverkäufe (Eigenfahrzeuge) trennen
  const werkstatt = auftraege.filter(a => a.fahrzeug?.fahrzeug_typ !== 'eigen')
  const eigenAlle = auftraege.filter(a => a.fahrzeug?.fahrzeug_typ === 'eigen')
  const eigenVerkauft = eigenAlle.filter(a => ['verkauft', 'ausgeliefert'].includes(a.status))
  const eigenImBestand = eigenAlle.filter(a => !['verkauft', 'ausgeliefert', 'storniert'].includes(a.status))

  // ── KPIs (Werkstatt) ─────────────────────────────────────────────────────────
  const fertige = werkstatt.filter(a => ['fertig', 'ausgeliefert'].includes(a.status))
  const offene  = werkstatt.filter(a => !['fertig', 'ausgeliefert'].includes(a.status))
  const gesamtEinnahmen = werkstatt.reduce((s, a) => s + (a.einnahmen ?? 0), 0)
  const gesamtEinkauf   = rechnungen.reduce((s, r) => s + (r.gesamt ?? 0), 0)
  const offeneTeile = teile.filter(t => ['nicht_bestellt', 'bestellt', 'unterwegs'].includes(t.status)).length
  const tuevBestanden = werkstatt.filter(a => a.tuev_ergebnis === 'bestanden').length
  const tuevGesamt    = werkstatt.filter(a => a.tuev_ergebnis).length

  // ── KPIs (Fahrzeugverkäufe / Gebrauchtwagen) ──────────────────────────────────
  const anzahlVerkauft = eigenVerkauft.length
  const verkaufsErloes = eigenVerkauft.reduce((s, a) => s + (a.einnahmen ?? 0), 0)
  const standtage = eigenVerkauft
    .filter(a => a.verkauft_am && a.erstellt_am)
    .map(a => Math.max(0, Math.round((new Date(a.verkauft_am).getTime() - new Date(a.erstellt_am).getTime()) / 86_400_000)))
  const avgStandtage = standtage.length ? Math.round(standtage.reduce((s, d) => s + d, 0) / standtage.length) : null
  const jetzt = Date.now()
  const ladenhueter = eigenImBestand.filter(a => a.erstellt_am && (jetzt - new Date(a.erstellt_am).getTime()) / 86_400_000 > 90)

  // ── Aufträge pro Monat ──────────────────────────────────────────────────────
  const auftragProMonat = months.map(m => {
    const abgeschlossen = werkstatt.filter(a => {
      const d = a.fertiggestellt_am ?? a.erstellt_am
      return d && d.startsWith(m.key)
    }).length
    const neu = werkstatt.filter(a => a.erstellt_am?.startsWith(m.key)).length
    return { monat: m.label, Abgeschlossen: abgeschlossen, Neu: neu }
  })

  // ── Einnahmen pro Monat (nur Werkstatt) ───────────────────────────────────────
  const einnahmenProMonat = months.map(m => {
    const summe = werkstatt
      .filter(a => (a.fertiggestellt_am ?? a.erstellt_am)?.startsWith(m.key))
      .reduce((s, a) => s + (a.einnahmen ?? 0), 0)
    return { monat: m.label, Einnahmen: Math.round(summe) }
  })

  // ── Fahrzeugverkäufe pro Monat (nach Verkaufsdatum) ───────────────────────────
  const verkaeufeProMonat = months.map(m => {
    const rs = eigenVerkauft.filter(a => (a.verkauft_am ?? '')?.startsWith(m.key))
    return { monat: m.label, Verkäufe: rs.length, Erlös: Math.round(rs.reduce((s, a) => s + (a.einnahmen ?? 0), 0)) }
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
  for (const a of werkstatt) statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1
  const statusPie = Object.entries(statusCounts).map(([s, v]) => ({
    name: FAHRZEUG_STATUS_LABEL[s as FahrzeugStatus] ?? s,
    value: v,
    color: STATUS_COLORS[s] ?? '#94a3b8',
  }))

  // ── Teile-Status ────────────────────────────────────────────────────────────
  const teilStatusCounts: Record<string, number> = {}
  for (const t of teile) teilStatusCounts[t.status] = (teilStatusCounts[t.status] ?? 0) + 1

  // ── Lager-Kosten ────────────────────────────────────────────────────────────
  const teilWert = (t: any) => (t.einzelpreis ?? 0) * (t.menge ?? 1)
  const lagerWert     = teile.filter(t => t.status === 'geliefert').reduce((s, t) => s + teilWert(t), 0)
  const bestelltWert  = teile.filter(t => ['bestellt','unterwegs','nicht_bestellt'].includes(t.status)).reduce((s, t) => s + teilWert(t), 0)
  const verbautWert   = teile.filter(t => t.status === 'eingebaut').reduce((s, t) => s + teilWert(t), 0)
  const gesamtTeilWert = teile.reduce((s, t) => s + teilWert(t), 0)

  const lagerAnzahl    = teile.filter(t => t.status === 'geliefert').length
  const bestelltAnzahl = teile.filter(t => ['bestellt','unterwegs','nicht_bestellt'].includes(t.status)).length
  const verbautAnzahl  = teile.filter(t => t.status === 'eingebaut').length

  // Top Teile nach Wert (auf Lager)
  const topLagerTeile = [...teile.filter(t => t.status === 'geliefert')]
    .sort((a, b) => teilWert(b) - teilWert(a))
    .slice(0, 8)

  // Teilekosten pro Monat (nach bestellt_am)
  const teileProMonat = months.map(m => {
    const summe = teile
      .filter(t => t.bestellt_am?.startsWith(m.key))
      .reduce((s, t) => s + teilWert(t), 0)
    return { monat: m.label, Teilekosten: Math.round(summe) }
  })

  // Top Lieferanten nach Teilewert
  const lieferantenTeilMap: Record<string, { wert: number; anzahl: number }> = {}
  for (const t of teile) {
    const l = t.lieferant ?? 'Unbekannt'
    if (!lieferantenTeilMap[l]) lieferantenTeilMap[l] = { wert: 0, anzahl: 0 }
    lieferantenTeilMap[l].wert   += teilWert(t)
    lieferantenTeilMap[l].anzahl += 1
  }
  const topTeilLieferanten = Object.entries(lieferantenTeilMap)
    .sort((a, b) => b[1].wert - a[1].wert)
    .slice(0, 6)
    .map(([name, { wert, anzahl }]) => ({ name, Wert: Math.round(wert), Anzahl: anzahl }))

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
          { label: 'Werkstatt-Aufträge', value: werkstatt.length,               icon: Car,          color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Abgeschlossen',      value: fertige.length,                 icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Offen / in Arbeit',  value: offene.length,                  icon: Wrench,       color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Wartende Teile',     value: offeneTeile,                    icon: Package,      color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Werkstatt-Einnahmen', value: `${gesamtEinnahmen.toFixed(0)} €`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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

      {/* Fahrzeugverkäufe (Gebrauchtwagen) */}
      {eigenAlle.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <Warehouse className="w-4 h-4 text-purple-500" /> Fahrzeugverkäufe & Lagerbestand
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Verkauft gesamt',   value: anzahlVerkauft,                          icon: Truck,     color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Verkaufserlös',     value: `${verkaufsErloes.toFixed(0)} €`,        icon: Euro,      color: 'text-green-600',  bg: 'bg-green-50' },
              { label: 'Im Bestand',        value: eigenImBestand.length,                   icon: Warehouse, color: 'text-blue-600',   bg: 'bg-blue-50' },
              { label: 'Ø Standzeit',       value: avgStandtage != null ? `${avgStandtage} Tage` : '—', icon: Clock, color: 'text-slate-600', bg: 'bg-slate-100' },
              { label: 'Ladenhüter >90 T.', value: ladenhueter.length,                      icon: AlertCircle, color: ladenhueter.length > 0 ? 'text-red-600' : 'text-gray-400', bg: ladenhueter.length > 0 ? 'bg-red-50' : 'bg-gray-50' },
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
          {ladenhueter.length > 0 && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {ladenhueter.length} {ladenhueter.length === 1 ? 'Fahrzeug steht' : 'Fahrzeuge stehen'} seit über 90 Tagen im Bestand.
            </p>
          )}
        </div>
      )}

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

      {/* ── Lager-Analyse ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <Warehouse className="w-4 h-4 text-green-600" /> Lager-Analyse
        </h2>

        {/* Lager KPI-Karten */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Gesamtwert Teile',  value: gesamtTeilWert,  count: teile.length,    icon: Package,   color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200' },
            { label: 'Auf Lager',         value: lagerWert,       count: lagerAnzahl,     icon: Warehouse, color: 'text-green-700',  bg: 'bg-green-50',  border: lagerWert > 0 ? 'border-green-300' : 'border-gray-200' },
            { label: 'Bestellt / Weg',    value: bestelltWert,    count: bestelltAnzahl,  icon: Truck,     color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
            { label: 'Verbaut',           value: verbautWert,     count: verbautAnzahl,   icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          ].map(({ label, value, count, icon: Icon, color, bg, border }) => (
            <Card key={label} className={`border-2 ${border}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <span className="text-xs text-gray-400">{count} Teile</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Teilekosten pro Monat + Top Lieferanten */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Euro className="w-4 h-4 text-orange-500" /> Teilekosten pro Monat (€)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={teileProMonat} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v} €`} />
                  <Tooltip formatter={(v: any) => [`${v.toLocaleString('de-DE')} €`, 'Teilekosten']} />
                  <Bar dataKey="Teilekosten" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-500" /> Top Lieferanten nach Teilewert
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topTeilLieferanten.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-gray-300 text-sm">Keine Daten</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topTeilLieferanten} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v} €`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip formatter={(v: any) => [`${v.toLocaleString('de-DE')} €`, 'Wert']} />
                    <Bar dataKey="Wert" radius={[0, 3, 3, 0]}>
                      {topTeilLieferanten.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Teile auf Lager */}
        {lagerAnzahl > 0 && (
          <Card className="border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Teile auf Lager — noch nicht verbaut
                <span className="ml-auto text-xs font-normal text-gray-400">Gesamtwert: {lagerWert.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topLagerTeile.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 bg-green-50/50 border border-green-100 rounded-lg">
                    <Package className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.bezeichnung}</p>
                      <p className="text-xs text-gray-500">
                        {t.menge}× {t.einzelpreis != null ? `${Number(t.einzelpreis).toFixed(2)} €` : '—'}
                        {t.lieferant ? ` · ${t.lieferant}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-green-800 flex-shrink-0">
                      {teilWert(t).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                ))}
                {lagerAnzahl > 8 && (
                  <p className="text-xs text-gray-400 text-center pt-1">+ {lagerAnzahl - 8} weitere Teile</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Ersatzteile Status + Hebebühnen */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-yellow-500" /> Lager nach Status (Anzahl)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {(['nicht_bestellt', 'bestellt', 'unterwegs', 'geliefert', 'eingebaut'] as TeilStatus[]).map(s => {
                const count = teilStatusCounts[s] ?? 0
                const wert  = teile.filter(t => t.status === s).reduce((sum, t) => sum + teilWert(t), 0)
                return (
                  <div key={s} className="text-center p-3 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: TEIL_COLORS[s] + '20', color: TEIL_COLORS[s] }}>
                      {TEIL_STATUS_LABEL[s]}
                    </span>
                    {wert > 0 && <p className="text-xs text-gray-400 mt-1">{wert.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €</p>}
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
