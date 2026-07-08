'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import { Car, Search, Plus, ChevronRight, Package, Tag, Gauge, Palette, Fuel, ArrowUpDown, Wrench, Euro, ShieldCheck, CheckCircle2, ExternalLink, Trash2, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'
import {
  type Auftrag, type FahrzeugStatus,
  FAHRZEUG_STATUS_LABEL, FAHRZEUG_STATUS_COLOR,
} from '@/types/database'
import { berechnePrioritaet, PRIORITAET_LABEL, PRIORITAET_COLOR, PRIORITAET_DOT } from '@/lib/prioritaet'
import { TuevWeckerContent } from '@/app/tuev-wecker/tuev-wecker-content'
import { ServiceWeckerContent } from '@/app/service-wecker/service-wecker-content'

const STATUS_FILTERS: { label: string; value: FahrzeugStatus | 'alle' }[] = [
  { label: 'Alle', value: 'alle' },
  { label: 'Angenommen', value: 'angenommen' },
  { label: 'Diagnose', value: 'diagnose' },
  { label: 'Reparatur', value: 'reparatur' },
  { label: 'Warten auf Teile', value: 'warten_teile' },
  { label: 'Fertig', value: 'fertig' },
  { label: 'Ausgeliefert', value: 'ausgeliefert' },
]

export function FahrzeugeContent({
  auftraege,
  tuevFahrzeuge,
  serviceFahrzeuge,
  standardSteuerart = 'differenz',
}: {
  auftraege: Auftrag[]
  tuevFahrzeuge: any[]
  serviceFahrzeuge: any[]
  standardSteuerart?: 'differenz' | 'regel' | 'ausfuhr'
}) {
  // Force Vercel rebuild with visible buttons
  const BUTTONS_VERSION = 2
  const router = useRouter()
  const searchParams = useSearchParams()
  // Default auf 'eigen' statt 'fremd' — Eigenfahrzeuge sind das Hauptfocus
  const [tab, setTab] = useState<'fremd' | 'eigen' | 'tuev' | 'service'>('eigen')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FahrzeugStatus | 'alle'>('alle')
  const [sortByPrio, setSortByPrio] = useState(true)
  const [verkaufenId, setVerkaufenId] = useState<string | null>(null)
  const [verkaufenLoading, setVerkaufenLoading] = useState(false)
  const [verkaufenPreis, setVerkaufenPreis] = useState('')
  // Steuerart wird beim Verkauf still auf den Standard (§25a) gesetzt bzw. eine bestehende Einstufung erhalten — Feinjustierung im Steuerblatt
  const [verkaufenSteuerart, setVerkaufenSteuerart] = useState<'differenz' | 'regel' | 'ausfuhr'>('differenz')
  const [verkaufenAuslieferung, setVerkaufenAuslieferung] = useState('')
  const [verkaufenKaeufer, setVerkaufenKaeufer] = useState('')
  const [uebergabeId, setUebergabeId] = useState<string | null>(null)
  const [uebergabeLoading, setUebergabeLoading] = useState(false)
  const [uebergabeDatum, setUebergabeDatum] = useState('')
  const [loeschen, setLoeschen] = useState<{ fahrzeugId: string; name: string; kennzeichen?: string } | null>(null)
  const [loeschenLoading, setLoeschenLoading] = useState(false)
  const [eigenSubTab, setEigenSubTab] = useState<'bestand' | 'verkauft' | 'uebergeben'>('bestand')

  // URL-Parameter verarbeiten
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const eigenSubTabParam = searchParams.get('eigenSubTab')
    if (tabParam === 'eigen' || tabParam === 'fremd' || tabParam === 'tuev' || tabParam === 'service') {
      setTab(tabParam)
    }
    if (eigenSubTabParam === 'bestand' || eigenSubTabParam === 'verkauft' || eigenSubTabParam === 'uebergeben') {
      setEigenSubTab(eigenSubTabParam)
    }
  }, [searchParams])

  const fremdAuftraege = auftraege.filter(a => (a.fahrzeug as any)?.fahrzeug_typ !== 'eigen')
  const eigenAuftraege = auftraege.filter(a => (a.fahrzeug as any)?.fahrzeug_typ === 'eigen')
  const eigenImBestand = eigenAuftraege.filter(a => a.status !== 'ausgeliefert' && a.status !== 'storniert' && a.status !== 'verkauft')
  const eigenBereitsVerkauft = eigenAuftraege.filter(a => a.status === 'verkauft' || a.status === 'ausgeliefert')  // BEIDE: verkauft + ausgeliefert
  const eigenVerkauft = eigenAuftraege.filter(a => a.status === 'ausgeliefert')  // nur ausgeliefert (für Übergeben-Tab)

  function openVerkaufen(auftrag: any) {
    const fz = auftrag.fahrzeug as any
    setVerkaufenId(auftrag.id)
    setVerkaufenPreis(fz?.verkaufspreis != null ? String(fz.verkaufspreis) : (auftrag.einnahmen ? String(auftrag.einnahmen) : ''))
    setVerkaufenSteuerart(auftrag.steuerart ?? standardSteuerart) // bestehende Einstufung erhalten, sonst Standard aus Einstellungen
    setVerkaufenAuslieferung(auftrag.auslieferung_geplant ?? '')
    setVerkaufenKaeufer(auftrag.kaeufer_name ?? '')
  }

  function resetVerkaufen() {
    setVerkaufenId(null)
    setVerkaufenPreis('')
    setVerkaufenSteuerart(standardSteuerart)
    setVerkaufenAuslieferung('')
    setVerkaufenKaeufer('')
  }

  async function handleVerkauft() {
    if (!verkaufenId) return
    setVerkaufenLoading(true)
    const sb = createClient()
    const updates: Record<string, any> = {
      status: 'verkauft',
      verkauft_am: new Date().toISOString().split('T')[0],
      steuerart: verkaufenSteuerart, // Standard §25a bzw. bestehende Einstufung
    }
    const preis = parseFloat(verkaufenPreis.replace(',', '.'))
    if (!isNaN(preis) && preis > 0) updates.einnahmen = preis
    if (verkaufenAuslieferung) updates.auslieferung_geplant = verkaufenAuslieferung
    if (verkaufenKaeufer.trim()) updates.kaeufer_name = verkaufenKaeufer.trim()
    await sb.from('auftraege').update(updates).eq('id', verkaufenId)

    setVerkaufenLoading(false)
    resetVerkaufen()
    router.refresh()
  }

  async function handleUebergabe() {
    if (!uebergabeId) return
    setUebergabeLoading(true)
    const sb = createClient()
    const updates: Record<string, any> = { status: 'ausgeliefert' }
    if (uebergabeDatum) updates.auslieferung_geplant = uebergabeDatum
    else updates.auslieferung_geplant = new Date().toISOString().split('T')[0]
    await sb.from('auftraege').update(updates).eq('id', uebergabeId)
    setUebergabeLoading(false)
    setUebergabeId(null)
    setUebergabeDatum('')
    router.refresh()
  }

  async function handleLoeschen() {
    if (!loeschen) return
    setLoeschenLoading(true)
    const sb = createClient()
    // fahrzeug löschen → auftraege/ersatzteile/fotos werden per ON DELETE CASCADE mitgelöscht
    await sb.from('fahrzeuge').delete().eq('id', loeschen.fahrzeugId)
    setLoeschenLoading(false)
    setLoeschen(null)
    router.refresh()
  }

  const filteredFremdRaw = fremdAuftraege.filter(a => {
    const matchStatus = statusFilter === 'alle' || a.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      a.fahrzeug?.marke?.toLowerCase().includes(q) ||
      a.fahrzeug?.modell?.toLowerCase().includes(q) ||
      a.fahrzeug?.kennzeichen?.toLowerCase().includes(q) ||
      a.kunde?.nachname?.toLowerCase().includes(q) ||
      a.kunde?.vorname?.toLowerCase().includes(q) ||
      a.auftrag_nr?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const filteredFremd = sortByPrio
    ? [...filteredFremdRaw].sort((a, b) => berechnePrioritaet(b).score - berechnePrioritaet(a).score)
    : filteredFremdRaw

  const filteredEigen = eigenImBestand.filter(a => {
    const q = search.toLowerCase()
    const fz = a.fahrzeug as any
    return !q ||
      fz?.marke?.toLowerCase().includes(q) ||
      fz?.modell?.toLowerCase().includes(q) ||
      fz?.kennzeichen?.toLowerCase().includes(q) ||
      fz?.mobile_de_id?.toLowerCase().includes(q) ||
      fz?.farbe?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fahrzeuge</h1>
          <p className="text-sm text-gray-800 mt-0.5">
            {fremdAuftraege.length} Kunden · {eigenImBestand.length} Lager{eigenVerkauft.length > 0 ? ` · ${eigenVerkauft.length} verkauft` : ''} · {tuevFahrzeuge.length} TÜV · {serviceFahrzeuge.length} Service
          </p>
        </div>
        <Link href="/fahrzeuge/neu">
          <Button className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Neues Fahrzeug
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        <button
          onClick={() => setTab('fremd')}
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all',
            tab === 'fremd' ? 'bg-orange-600 text-white border-orange-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          <Car className="w-4 h-4" />
          Kundenfahrzeuge
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full', tab === 'fremd' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>
            {fremdAuftraege.length}
          </span>
        </button>
        <button
          onClick={() => setTab('eigen')}
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all',
            tab === 'eigen' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          <Wrench className="w-4 h-4" />
          Lagerbestand
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full', tab === 'eigen' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>
            {eigenAuftraege.length}
          </span>
        </button>
        <button
          onClick={() => setTab('tuev')}
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all',
            tab === 'tuev' ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          <ShieldCheck className="w-4 h-4" />
          TÜV-Wecker
          {tuevFahrzeuge.length > 0 && (
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full', tab === 'tuev' ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700')}>
              {tuevFahrzeuge.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('service')}
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all',
            tab === 'service' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          <Wrench className="w-4 h-4" />
          Service-Wecker
          {serviceFahrzeuge.length > 0 && (
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full', tab === 'service' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700')}>
              {serviceFahrzeuge.length}
            </span>
          )}
        </button>
      </div>

      {/* 🎯 QUICK ACCESS BUTTONS — HIGHLY VISIBLE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 px-3 bg-gray-50 rounded-xl border-2 border-gray-200 mt-4">
        <Link href="/fahrzeuge/verkauft" className="w-full">
          <button className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 px-6 py-5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl font-bold text-lg border-2 border-green-700">
            <span className="text-4xl">💰</span>
            <div className="text-center sm:text-left">
              <div className="font-bold text-lg">Verkaufte Fahrzeuge</div>
              <div className="text-sm opacity-90">{eigenBereitsVerkauft.length} Fahrzeuge</div>
            </div>
          </button>
        </Link>
        <Link href="/fahrzeuge/uebergeben" className="w-full">
          <button className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 px-6 py-5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-bold text-lg border-2 border-emerald-700">
            <span className="text-4xl">✅</span>
            <div className="text-center sm:text-left">
              <div className="font-bold text-lg">Übergeben</div>
              <div className="text-sm opacity-90">{eigenVerkauft.length} Fahrzeuge</div>
            </div>
          </button>
        </Link>
      </div>

      {/* Eigenfahrzeug Sub-Tabs: direkt nach Haupt-Tabs */}
      {tab === 'eigen' && (
        <>
          {/* Mobile: Select (VERY VISIBLE) */}
          <div className="block lg:hidden mt-4 px-0">
            <label className="block text-xs font-semibold text-gray-600 mb-2">Ansicht wählen:</label>
            <select
              value={eigenSubTab}
              onChange={e => setEigenSubTab(e.target.value as 'bestand' | 'verkauft' | 'uebergeben')}
              className="w-full px-4 py-3 border-2 border-purple-400 rounded-lg text-base font-semibold bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="bestand">📦 Im Bestand ({eigenImBestand.length})</option>
              <option value="verkauft">💰 Verkauft ({eigenBereitsVerkauft.length})</option>
              <option value="uebergeben">✅ Übergeben ({eigenVerkauft.length})</option>
            </select>
          </div>

          {/* Desktop: Buttons */}
          <div className="hidden md:flex gap-2 mt-3">
            <button
              onClick={() => setEigenSubTab('bestand')}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                eigenSubTab === 'bestand' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}
            >
              Im Bestand
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full', eigenSubTab === 'bestand' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>
                {eigenImBestand.length}
              </span>
            </button>
            <Link href="/fahrzeuge/verkauft">
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border bg-green-600 text-white border-green-600 hover:bg-green-700 transition-all"
              >
                💰 Verkauft
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                  {eigenBereitsVerkauft.length}
                </span>
              </button>
            </Link>
            <button
              onClick={() => setEigenSubTab('uebergeben')}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                eigenSubTab === 'uebergeben' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}
            >
              Übergeben
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full', eigenSubTab === 'uebergeben' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>
                {eigenVerkauft.length}
              </span>
            </button>
          </div>
        </>
      )}

      {/* Search — nur für Auftrags-Tabs */}
      {(tab === 'fremd' || tab === 'eigen') && <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'fremd' ? 'Marke, Modell, Kennzeichen, Kunde...' : 'Marke, Modell, B-Nummer, Farbe...'}
            className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        {tab === 'fremd' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            <button
              onClick={() => setSortByPrio(v => !v)}
              className={cn(
                'flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center gap-1.5',
                sortByPrio
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-600 border-gray-200'
              )}
            >
              <ArrowUpDown className="w-4 h-4" />
              Priorität
            </button>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors',
                  statusFilter === f.value
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* Fremdfahrzeuge */}
      {tab === 'fremd' && (
        filteredFremd.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Car className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-800">Keine Fahrzeuge gefunden</p>
              <Link href="/fahrzeuge/neu">
                <Button className="mt-4 bg-orange-600 hover:bg-orange-700 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Fahrzeug anlegen
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (<>
          {/* Karten-Ansicht: Handy + Tablet (unter xl:) */}
          <div className="xl:hidden space-y-2">
            {filteredFremd.map(auftrag => {
              const teile = auftrag.ersatzteile ?? []
              const kritisch = teile.filter((t: any) => ['nicht_bestellt', 'bestellt'].includes(t.status)).length
              const overdue = auftrag.geplante_fertigstellung &&
                auftrag.geplante_fertigstellung < new Date().toISOString().split('T')[0] &&
                !['fertig', 'ausgeliefert'].includes(auftrag.status)
              const prio = berechnePrioritaet(auftrag)

              return (
                <div
                  key={auftrag.id}
                  onClick={() => router.push(`/fahrzeuge/${auftrag.id}`)}
                  className={cn(
                    'bg-white border rounded-2xl px-4 py-4 flex items-center gap-4 cursor-pointer active:scale-[0.99] transition-all',
                    prio.stufe === 'kritisch' ? 'border-red-200 bg-red-50/30' : 'border-gray-200 hover:border-orange-200 hover:shadow-sm'
                  )}
                >
                  {/* Prioritäts-Dot */}
                  <div className={cn(
                    'w-1.5 self-stretch rounded-full flex-shrink-0',
                    prio.stufe === 'kritisch' ? 'bg-red-500' :
                    prio.stufe === 'hoch'     ? 'bg-orange-400' :
                    prio.stufe === 'mittel'   ? 'bg-yellow-400' : 'bg-gray-200'
                  )} />

                  {/* Auto-Icon */}
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Car className="w-6 h-6 text-gray-500" />
                  </div>

                  {/* Inhalt */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-base leading-tight truncate">
                          {auftrag.fahrzeug?.marke} {auftrag.fahrzeug?.modell}
                        </p>
                        <p className="text-sm text-gray-500 font-mono mt-0.5">{auftrag.fahrzeug?.kennzeichen}</p>
                      </div>
                      <span className={cn(
                        'flex-shrink-0 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border mt-0.5',
                        FAHRZEUG_STATUS_COLOR[auftrag.status]
                      )}>
                        {FAHRZEUG_STATUS_LABEL[auftrag.status]}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {auftrag.kunde && (
                        <span className="text-sm text-gray-600">
                          {auftrag.kunde.vorname} {auftrag.kunde.nachname}
                        </span>
                      )}
                      {auftrag.hebebuehne && (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                          {auftrag.hebebuehne.bezeichnung}
                        </span>
                      )}
                      {kritisch > 0 && (
                        <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Package className="w-3 h-3" /> {kritisch} Teile offen
                        </span>
                      )}
                      {overdue && (
                        <span className="text-xs text-red-600 font-medium">⚠ Überfällig</span>
                      )}
                      {auftrag.geplante_fertigstellung && !overdue && (
                        <span className="text-xs text-gray-400">
                          bis {formatDate(auftrag.geplante_fertigstellung)}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                </div>
              )
            })}
          </div>

          {/* Tabellen-Ansicht: nur Desktop (xl+) */}
          <div className="hidden xl:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Fahrzeug</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Kunde</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Priorität</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Bühne</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Teile</th>
                    <th className="text-left text-xs font-semibold text-gray-800 uppercase tracking-wide px-4 py-3">Fertig bis</th>
                    <th className="w-8 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredFremd.map(auftrag => {
                    const teile = auftrag.ersatzteile ?? []
                    const kritisch = teile.filter((t: any) => ['nicht_bestellt', 'bestellt'].includes(t.status)).length
                    const overdue = auftrag.geplante_fertigstellung &&
                      auftrag.geplante_fertigstellung < new Date().toISOString().split('T')[0] &&
                      !['fertig', 'ausgeliefert'].includes(auftrag.status)
                    const prio = berechnePrioritaet(auftrag)
                    return (
                      <tr key={auftrag.id} onClick={() => router.push(`/fahrzeuge/${auftrag.id}`)} className={cn(
                        'hover:bg-orange-50/30 transition-colors cursor-pointer',
                        prio.stufe === 'kritisch' && 'bg-red-50/40'
                      )}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Car className="w-4 h-4 text-gray-800" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{auftrag.fahrzeug?.marke} {auftrag.fahrzeug?.modell}</p>
                              <p className="text-xs text-gray-600 font-mono">{auftrag.fahrzeug?.kennzeichen}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm text-gray-700">{auftrag.kunde?.vorname} {auftrag.kunde?.nachname}</p>
                          {auftrag.kunde?.firma && <p className="text-xs text-gray-600">{auftrag.kunde.firma}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border', FAHRZEUG_STATUS_COLOR[auftrag.status])}>
                            {FAHRZEUG_STATUS_LABEL[auftrag.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {prio.stufe !== 'normal' ? (
                            <div className="flex flex-col gap-1">
                              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', PRIORITAET_COLOR[prio.stufe])}>
                                <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITAET_DOT[prio.stufe])} />
                                {PRIORITAET_LABEL[prio.stufe]}
                              </span>
                              {prio.gruende[0] && <span className="text-[10px] text-gray-400 leading-tight">{prio.gruende[0]}</span>}
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {auftrag.hebebuehne ? <span className="text-sm text-gray-700">{auftrag.hebebuehne.bezeichnung}</span> : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {teile.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Package className="w-3.5 h-3.5 text-gray-600" />
                              <span className="text-sm text-gray-700">{teile.length}</span>
                              {kritisch > 0 && <span className="text-xs text-red-600 font-medium">({kritisch} offen)</span>}
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {auftrag.geplante_fertigstellung ? (
                            <span className={cn('text-sm', overdue ? 'text-red-600 font-medium' : 'text-gray-700')}>{formatDate(auftrag.geplante_fertigstellung)}</span>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>)
      )}

      {/* Eigenfahrzeuge Content */}
      {tab === 'eigen' && (
        <>
          {/* Verkauft-Liste (Status = verkauft) */}
          {eigenSubTab === 'verkauft' && eigenBereitsVerkauft.length > 0 && (
            <div className="flex justify-end">
              <Link href="/fahrzeuge/verkauft" className="flex items-center gap-1.5 text-sm text-green-600 font-medium hover:text-green-800 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
                Steuerblatt & Übergeben
              </Link>
            </div>
          )}
          {eigenSubTab === 'verkauft' && (
            eigenBereitsVerkauft.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 text-sm">Noch keine Fahrzeuge verkauft</p>
              </CardContent></Card>
            ) : (() => {
                const heute = new Date().toISOString().split('T')[0]
                // Sortieren: neueste zuerst, kein Datum ans Ende
                const sorted = [...eigenBereitsVerkauft].sort((a, b) => {
                  const da = (a as any).verkauft_am ?? ''
                  const db = (b as any).verkauft_am ?? ''
                  return db.localeCompare(da)
                })
                // Nach Monat gruppieren
                const groups: { label: string; key: string; items: typeof sorted; summe: number }[] = []
                for (const a of sorted) {
                  const vk = (a as any).verkauft_am as string | null
                  const key = vk ? vk.slice(0, 7) : 'unbekannt'
                  const label = vk
                    ? new Date(vk + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
                    : 'Kein Datum'
                  let g = groups.find(g => g.key === key)
                  if (!g) { g = { label, key, items: [], summe: 0 }; groups.push(g) }
                  g.items.push(a)
                  g.summe += (a as any).einnahmen ?? 0
                }
                return (
                  <div className="space-y-4">
                    {groups.map(group => (
                      <div key={group.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {/* Monats-Header */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                          <span className="text-sm font-semibold text-gray-700">{group.label}</span>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{group.items.length} {group.items.length === 1 ? 'Fahrzeug' : 'Fahrzeuge'}</span>
                            {group.summe > 0 && (
                              <span className="font-semibold text-green-700">
                                {group.summe.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <tbody>
                              {group.items.map(a => {
                                const fz = a.fahrzeug as any
                                const vk = (a as any).verkauft_am as string | null
                                const al = (a as any).auslieferung_geplant as string | null
                                const preis = (a as any).einnahmen as number | null
                                const ausstehend = al && al >= heute
                                const kaeufer = (a as any).kaeufer_name ?? (a as any).bemerkungen?.match(/Käufer:\s*(.+)/)?.[1]?.trim() ?? null
                                return (
                                  <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-gray-900">{fz?.marke} {fz?.modell}</p>
                                      <p className="text-xs text-gray-400 font-mono">{fz?.kennzeichen || '—'}</p>
                                      {kaeufer && <p className="text-xs text-gray-500 mt-0.5">→ {kaeufer}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">
                                      {vk ? new Date(vk).toLocaleDateString('de-DE') : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                      {preis && preis > 0
                                        ? <span className="font-semibold text-green-700">{preis.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                                        : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {al
                                        ? <span className={cn('text-sm', ausstehend ? 'text-orange-600 font-medium' : 'text-gray-500')}>{new Date(al).toLocaleDateString('de-DE')}{ausstehend && ' ⏳'}</span>
                                        : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                      <Link href={`/fahrzeuge/${a.id}`}><ChevronRight className="w-4 h-4 text-gray-300" /></Link>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()
          )}

          {/* Übergeben-Seite (Link zu Archiv) */}
          {eigenSubTab === 'uebergeben' && (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Übergeben-Archiv</h3>
              <p className="text-gray-600 mb-6">Alle übergebenen Fahrzeuge und detaillierte Verkaufshistorie</p>
              <Link href="/fahrzeuge/uebergeben">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Zum Archiv ({eigenVerkauft.length})
                </Button>
              </Link>
            </div>
          )}

          {/* Bestand-Karten */}
          {eigenSubTab === 'bestand' && (filteredEigen.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Car className="w-12 h-12 mx-auto mb-3 text-purple-200" />
              <p className="text-gray-800">Kein Lagerbestand erfasst</p>
              <p className="text-sm text-gray-600 mt-1">Lege ein neues Fahrzeug an und wähle "Eigenfahrzeug" (Lagerbestand)</p>
              <Link href="/fahrzeuge/neu">
                <Button className="mt-4 bg-purple-600 hover:bg-purple-700 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Eigenfahrzeug anlegen
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEigen.map(auftrag => {
              const fz = auftrag.fahrzeug as any
              // Bevorzugt echte Spalte, Fallback auf Alt-Text in notizen
              const verkaufspreis = fz?.verkaufspreis != null
                ? Number(fz.verkaufspreis).toLocaleString('de-DE', { minimumFractionDigits: 0 })
                : (fz?.notizen?.match(/Verkaufspreis:\s*([\d.,]+)\s*€/)?.[1] ?? null)
              const bilderUrls: string[] = (() => { try { return fz?.bilder_urls ? JSON.parse(fz.bilder_urls) : [] } catch { return [] } })()
              const hauptbild = bilderUrls[0] ?? null
              const teile = (auftrag.ersatzteile ?? []) as any[]
              const teileKosten = teile.reduce((s: number, t: any) => s + (t.einzelpreis ?? 0) * (t.menge ?? 1), 0)
              const einnahmen: number = (auftrag as any).einnahmen ?? 0

              return (
                <div key={auftrag.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-purple-300 hover:shadow-md transition-all group flex flex-col">
                  <Link href={`/fahrzeuge/${auftrag.id}`} className="flex-1">
                    {hauptbild && (
                      <div className="h-36 w-full overflow-hidden bg-gray-100">
                        <img src={hauptbild} alt={`${fz?.marke} ${fz?.modell}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    )}
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {!hauptbild && (
                            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                              <Car className="w-4 h-4 text-purple-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">
                              {fz?.marke} {fz?.modell}
                            </p>
                            {fz?.mobile_de_id && (
                              <p className="text-xs font-mono text-purple-500">{fz.mobile_de_id}</p>
                            )}
                          </div>
                        </div>
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', FAHRZEUG_STATUS_COLOR[auftrag.status])}>
                          {FAHRZEUG_STATUS_LABEL[auftrag.status]}
                        </span>
                      </div>

                      {/* Fahrzeugdaten */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-600 mb-3">
                        {fz?.baujahr && <div className="flex items-center gap-1"><Tag className="w-3 h-3" /><span>{fz.baujahr}</span></div>}
                        {fz?.kilometerstand && <div className="flex items-center gap-1"><Gauge className="w-3 h-3" /><span>{fz.kilometerstand.toLocaleString('de-DE')} km</span></div>}
                        {fz?.farbe && <div className="flex items-center gap-1"><Palette className="w-3 h-3" /><span>{fz.farbe}</span></div>}
                        {fz?.motortyp && <div className="flex items-center gap-1"><Fuel className="w-3 h-3" /><span>{fz.motortyp}{fz.leistung_kw ? ` · ${fz.leistung_kw} kW` : ''}</span></div>}
                      </div>

                      {/* Arbeiten */}
                      {auftrag.arbeiten && (
                        <div className="flex items-start gap-1.5 text-xs text-gray-600 mb-3 bg-gray-50 rounded-lg px-2.5 py-2">
                          <Wrench className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-400" />
                          <span className="line-clamp-2">{auftrag.arbeiten}</span>
                        </div>
                      )}

                      {/* Kosten-Zeile */}
                      {(einnahmen > 0 || teile.length > 0) && (
                        <div className="flex items-center gap-3 mb-3 text-xs">
                          {einnahmen > 0 && (
                            <div className="flex items-center gap-1 text-purple-700 font-semibold">
                              <Euro className="w-3 h-3" />
                              <span>{einnahmen.toLocaleString('de-DE', { minimumFractionDigits: 2 })} Gesamtkosten</span>
                            </div>
                          )}
                          {teile.length > 0 && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <Package className="w-3 h-3" />
                              <span>{teile.length} {teile.length === 1 ? 'Teil' : 'Teile'}</span>
                              {teileKosten > 0 && <span className="text-gray-400">· {teileKosten.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Kennzeichen + Verkaufspreis */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <span className="text-xs font-mono text-gray-500">{fz?.kennzeichen || 'Kein KZ'}</span>
                        {verkaufspreis && (
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400 leading-none mb-0.5">Verkaufspreis</p>
                            <p className="text-sm font-bold text-purple-700">{verkaufspreis} €</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Aktionen */}
                  <div className="px-4 pb-4 flex items-center gap-2">
                    {auftrag.status === 'verkauft' ? (
                      <button
                        onClick={() => setUebergabeId(auftrag.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Übergabe durchführen
                      </button>
                    ) : (
                      <button
                        onClick={() => openVerkaufen(auftrag)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-purple-200 text-purple-700 text-sm font-medium hover:bg-purple-50 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Als verkauft markieren
                      </button>
                    )}
                    <button
                      onClick={() => setLoeschen({ fahrzeugId: fz?.id, name: `${fz?.marke ?? ''} ${fz?.modell ?? ''}`.trim() || 'Fahrzeug', kennzeichen: fz?.kennzeichen })}
                      title="Aus Bestand löschen"
                      className="flex-shrink-0 p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        </>
      )}

      {/* TÜV-Wecker Tab */}
      {tab === 'tuev' && (
        <TuevWeckerContent fahrzeuge={tuevFahrzeuge} />
      )}

      {/* Service-Wecker Tab */}
      {tab === 'service' && (
        <ServiceWeckerContent fahrzeuge={serviceFahrzeuge} />
      )}

      {/* Übergabe-Modal */}
      {uebergabeId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Übergabe durchführen?</h2>
                <p className="text-sm text-gray-500 mt-0.5">Das Fahrzeug wird als ausgeliefert markiert und aus dem Lagerbestand entfernt.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Übergabedatum</label>
              <input
                type="date"
                value={uebergabeDatum}
                onChange={e => setUebergabeDatum(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <p className="text-xs text-gray-400 mt-1">Leer lassen = heute</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setUebergabeId(null); setUebergabeDatum('') }} disabled={uebergabeLoading}>
                Abbrechen
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleUebergabe} disabled={uebergabeLoading}>
                {uebergabeLoading ? 'Speichern…' : '✓ Ausgeliefert'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Verkauft-Bestätigungsmodal */}
      {verkaufenId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Fahrzeug als verkauft markieren</h2>
                <p className="text-sm text-gray-500 mt-0.5">Vertrag unterschrieben — das Fahrzeug bleibt sichtbar bis zur Übergabe.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Käufer Name (optional)</label>
              <input
                type="text"
                placeholder="Max Mustermann"
                value={verkaufenKaeufer}
                onChange={e => setVerkaufenKaeufer(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verkaufspreis</label>
                <div className="relative">
                  <input
                    type="number" inputMode="decimal" placeholder="0,00"
                    value={verkaufenPreis}
                    onChange={e => setVerkaufenPreis(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auslieferung geplant</label>
                <input
                  type="date"
                  value={verkaufenAuslieferung}
                  onChange={e => setVerkaufenAuslieferung(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Einkaufspreis & Steuerart (Standard §25a) trägst du danach gebündelt im <span className="font-medium text-purple-600">Steuerblatt</span> ein.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={resetVerkaufen} disabled={verkaufenLoading}>
                Abbrechen
              </Button>
              <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" onClick={handleVerkauft} disabled={verkaufenLoading}>
                {verkaufenLoading ? 'Speichern…' : '✓ Verkauft'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Löschen-Bestätigungsmodal */}
      {loeschen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Fahrzeug aus dem Bestand löschen?</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  <span className="font-medium text-gray-700">{loeschen.name}</span>
                  {loeschen.kennzeichen ? ` · ${loeschen.kennzeichen}` : ''}
                </p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-sm text-red-700">
              Das Fahrzeug wird endgültig gelöscht (inkl. Auftrag, Ersatzteile & Fotos). Dies kann nicht rückgängig gemacht werden. Über Mobile.de kann es jederzeit erneut importiert werden.
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setLoeschen(null)} disabled={loeschenLoading}>
                Abbrechen
              </Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleLoeschen} disabled={loeschenLoading}>
                {loeschenLoading ? 'Löschen…' : 'Endgültig löschen'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
