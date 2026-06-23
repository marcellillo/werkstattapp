'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Package, Search, ChevronRight, Car, Truck, CheckCircle2, Archive, Boxes, AlertCircle, ClipboardList, Minus, Plus, ShoppingCart, PackageCheck, Wrench, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import { type TeilStatus, TEIL_STATUS_LABEL, TEIL_STATUS_COLOR } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

type Tab = 'aktiv' | 'geplant' | 'bestellt' | 'auf_lager' | 'archiv'

const TABS: { value: Tab; label: string; icon: any; description: string }[] = [
  { value: 'aktiv',     label: 'Aktiv',     icon: Boxes,         description: 'Alle offenen Teile' },
  { value: 'geplant',   label: 'Geplant',   icon: ClipboardList, description: 'Noch nicht bestellt' },
  { value: 'bestellt',  label: 'Bestellt',  icon: Truck,         description: 'Beim Lieferanten' },
  { value: 'auf_lager', label: 'Auf Lager', icon: Package,       description: 'Angekommen, nicht verbaut' },
  { value: 'archiv',    label: 'Archiv',    icon: Archive,       description: 'Eingebaut ins Fahrzeug' },
]

const TEIL_STATUS_ORDER: TeilStatus[] = [
  'nicht_bestellt', 'bestellt', 'unterwegs', 'geliefert', 'eingebaut'
]

function tabMatchesStatus(tab: Tab, status: TeilStatus): boolean {
  if (tab === 'aktiv')     return status !== 'eingebaut'
  if (tab === 'auf_lager') return status === 'geliefert'
  if (tab === 'bestellt')  return status === 'bestellt' || status === 'unterwegs'
  if (tab === 'geplant')   return status === 'nicht_bestellt'
  if (tab === 'archiv')    return status === 'eingebaut'
  return true
}

// Welcher Button + Farbe pro Tab
function getAction(tab: Tab): { label: string; nextStatus: TeilStatus; color: string; icon: any } | null {
  if (tab === 'geplant')   return { label: 'Bestellen',    nextStatus: 'bestellt',  color: 'bg-yellow-500 hover:bg-yellow-600 text-white', icon: ShoppingCart }
  if (tab === 'bestellt')  return { label: 'Angekommen ✓', nextStatus: 'geliefert', color: 'bg-blue-500 hover:bg-blue-600 text-white',   icon: PackageCheck }
  if (tab === 'auf_lager') return { label: 'Eingebaut ✓',  nextStatus: 'eingebaut', color: 'bg-green-500 hover:bg-green-600 text-white',  icon: Wrench }
  return null
}

export function TeileContent({ teile: initialTeile }: { teile: any[] }) {
  const [teile, setTeile] = useState(initialTeile)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('aktiv')
  const [editingMenge, setEditingMenge] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ neuErstellt: number; statusAktualisiert: number; fehler: string[] } | null>(null)
  const supabase = createClient()

  const filtered = teile.filter(t => {
    const matchTab = tabMatchesStatus(tab, t.status as TeilStatus)
    const q = search.toLowerCase()
    const matchSearch = !q ||
      t.bezeichnung?.toLowerCase().includes(q) ||
      t.teilenummer?.toLowerCase().includes(q) ||
      t.lieferant?.toLowerCase().includes(q) ||
      t.auftrag?.fahrzeug?.kennzeichen?.toLowerCase().includes(q) ||
      t.auftrag?.kunde?.nachname?.toLowerCase().includes(q)
    return matchTab && matchSearch
  })

  async function handleStatusChange(id: string, status: TeilStatus) {
    setTeile(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    await supabase.from('ersatzteile').update({ status }).eq('id', id)
  }

  async function handleMengeChange(id: string, delta: number) {
    const teil = teile.find(t => t.id === id)
    if (!teil) return
    const newMenge = Math.max(1, (teil.menge ?? 1) + delta)
    setTeile(prev => prev.map(t => t.id === id ? { ...t, menge: newMenge } : t))
    await supabase.from('ersatzteile').update({ menge: newMenge }).eq('id', id)
  }

  async function handleMengeSet(id: string, value: string) {
    const n = parseInt(value)
    if (isNaN(n) || n < 1) return
    setTeile(prev => prev.map(t => t.id === id ? { ...t, menge: n } : t))
    await supabase.from('ersatzteile').update({ menge: n }).eq('id', id)
  }

  async function handleEmailSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/email-sync', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setSyncResult({ neuErstellt: 0, statusAktualisiert: 0, fehler: [data.error] })
      } else {
        setSyncResult({ neuErstellt: data.neuErstellt ?? 0, statusAktualisiert: data.statusAktualisiert ?? 0, fehler: data.fehler ?? [] })
        if ((data.neuErstellt ?? 0) + (data.statusAktualisiert ?? 0) > 0) {
          // Seite neu laden um aktualisierte Teile zu sehen
          window.location.reload()
        }
      }
    } catch (e: any) {
      setSyncResult({ neuErstellt: 0, statusAktualisiert: 0, fehler: [e.message] })
    } finally {
      setSyncing(false)
    }
  }

  async function handleAllesBestellen() {
    const zuBestellen = teile.filter(t => t.status === 'nicht_bestellt')
    if (zuBestellen.length === 0) return
    setBulkLoading(true)
    setTeile(prev => prev.map(t => t.status === 'nicht_bestellt' ? { ...t, status: 'bestellt' } : t))
    await supabase.from('ersatzteile').update({ status: 'bestellt' }).eq('status', 'nicht_bestellt')
    setBulkLoading(false)
  }

  const aufLager  = teile.filter(t => t.status === 'geliefert').length
  const bestellt  = teile.filter(t => ['bestellt','unterwegs'].includes(t.status)).length
  const geplant   = teile.filter(t => t.status === 'nicht_bestellt').length
  const archiv    = teile.filter(t => t.status === 'eingebaut').length
  const aktiv     = teile.filter(t => t.status !== 'eingebaut').length

  const tabCounts: Record<Tab, number> = { aktiv, geplant, bestellt, auf_lager: aufLager, archiv }

  const TAB_ACTIVE_COLOR: Record<Tab, string> = {
    aktiv:    'border-orange-500 bg-orange-50',
    geplant:  'border-yellow-500 bg-yellow-50',
    bestellt: 'border-blue-500 bg-blue-50',
    auf_lager:'border-green-500 bg-green-50',
    archiv:   'border-gray-400 bg-gray-50',
  }
  const TAB_ICON_COLOR: Record<Tab, string> = {
    aktiv:    'text-orange-600',
    geplant:  'text-yellow-600',
    bestellt: 'text-blue-600',
    auf_lager:'text-green-600',
    archiv:   'text-gray-500',
  }

  const action = getAction(tab)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lager</h1>
          <p className="text-sm text-gray-500 mt-0.5">{aktiv} aktive · {archiv} archiviert</p>
        </div>
        <div className="flex items-center gap-2">
          {aufLager > 0 && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
              <Package className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-800">{aufLager} auf Lager</span>
            </div>
          )}
          <button
            onClick={handleEmailSync}
            disabled={syncing}
            title="E-Mails von Nora Zentrum & PV prüfen"
            className="flex items-center gap-2 bg-white border border-gray-200 hover:border-orange-400 hover:text-orange-600 text-gray-600 text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
          >
            <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
            {syncing ? 'Prüfe E-Mails…' : 'E-Mails prüfen'}
          </button>
        </div>
      </div>

      {/* Sync-Ergebnis */}
      {syncResult && (
        <div className={cn(
          'rounded-xl p-4 text-sm flex items-start gap-3',
          syncResult.fehler.length > 0 && syncResult.neuErstellt === 0 && syncResult.statusAktualisiert === 0
            ? 'bg-red-50 border border-red-200 text-red-800'
            : 'bg-blue-50 border border-blue-200 text-blue-800'
        )}>
          <RefreshCw className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            {syncResult.fehler.length > 0 && syncResult.neuErstellt === 0 && syncResult.statusAktualisiert === 0 ? (
              <>
                <p className="font-semibold">Fehler beim E-Mail-Abruf</p>
                <p className="mt-0.5">{syncResult.fehler[0]}</p>
                {syncResult.fehler[0].includes('konfiguriert') && (
                  <Link href="/einstellungen" className="underline font-medium">→ Jetzt in Einstellungen einrichten</Link>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold">
                  {syncResult.statusAktualisiert + syncResult.neuErstellt === 0
                    ? 'Keine neuen E-Mails gefunden.'
                    : `${syncResult.statusAktualisiert} ${syncResult.statusAktualisiert === 1 ? 'Teil' : 'Teile'} aktualisiert${syncResult.neuErstellt > 0 ? `, ${syncResult.neuErstellt} neu angelegt` : ''}.`}
                </p>
                {syncResult.fehler.length > 0 && (
                  <p className="mt-0.5 text-blue-600">{syncResult.fehler.length} E-Mail(s) konnten nicht verarbeitet werden.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {TABS.map(({ value, label, icon: Icon, description }) => {
          const count = tabCounts[value]
          const active = tab === value
          return (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                'p-3 rounded-xl border-2 text-left transition-all',
                active ? TAB_ACTIVE_COLOR[value] : 'border-gray-100 bg-white hover:border-gray-300'
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className={cn('w-4 h-4', active ? TAB_ICON_COLOR[value] : 'text-gray-400')} />
                <span className={cn('text-xl font-bold', active ? 'text-gray-900' : 'text-gray-700')}>{count}</span>
              </div>
              <p className={cn('text-sm font-semibold', active ? 'text-gray-900' : 'text-gray-600')}>{label}</p>
              <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{description}</p>
            </button>
          )
        })}
      </div>

      {/* Kontext-Banner + Sammelbestellung */}
      {tab === 'geplant' && geplant > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <ClipboardList className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-yellow-800">
                {geplant} {geplant === 1 ? 'Teil muss' : 'Teile müssen'} noch bestellt werden
              </p>
              <p className="text-xs text-yellow-600 mt-0.5">Einzeln bestellen oder alle auf einmal.</p>
            </div>
          </div>
          <button
            onClick={handleAllesBestellen}
            disabled={bulkLoading}
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-60 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            <ShoppingCart className="w-4 h-4" />
            {bulkLoading ? 'Wird bestellt…' : `Alle ${geplant} bestellen`}
          </button>
        </div>
      )}
      {tab === 'geplant' && geplant === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700">Alle Teile sind bestellt — nichts offen.</p>
        </div>
      )}
      {tab === 'bestellt' && bestellt > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <Truck className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            <span className="font-bold">{bestellt} {bestellt === 1 ? 'Teil ist' : 'Teile sind'}</span> beim Lieferanten.
            Wenn ein Teil ankommt → <span className="font-bold">„Angekommen ✓"</span> drücken.
          </p>
        </div>
      )}
      {tab === 'auf_lager' && aufLager === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700">Kein Teil liegt unverbaut auf Lager — alles verbaut oder noch unterwegs.</p>
        </div>
      )}
      {tab === 'auf_lager' && aufLager > 0 && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-4 flex items-center gap-3">
          <PackageCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">
            <span className="font-bold">{aufLager} {aufLager === 1 ? 'Teil liegt' : 'Teile liegen'}</span> auf Lager und warten aufs Einbauen.
            Wenn verbaut → <span className="font-bold">„Eingebaut ✓"</span> drücken.
          </p>
        </div>
      )}
      {tab === 'archiv' && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <Archive className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <p className="text-sm text-gray-600">
            {archiv === 0 ? 'Noch keine Teile verbaut.' : `${archiv} ${archiv === 1 ? 'Teil wurde' : 'Teile wurden'} eingebaut.`}
          </p>
        </div>
      )}

      {/* Suche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Bezeichnung, Teilenummer, Lieferant, Kennzeichen..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Keine Teile in dieser Kategorie</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(teil => (
            <div
              key={teil.id}
              className={cn(
                'bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors',
                teil.status === 'eingebaut' && 'opacity-50'
              )}
            >
              {/* Linke Seite: Teil-Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{teil.bezeichnung}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      {teil.teilenummer && (
                        <span className="text-xs text-gray-400 font-mono">{teil.teilenummer}</span>
                      )}
                      {teil.lieferant && (
                        <span className="text-xs text-gray-500">{teil.lieferant}</span>
                      )}
                      {teil.einzelpreis != null && (
                        <span className="text-xs text-gray-500 font-medium">
                          {(teil.einzelpreis * teil.menge).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                        </span>
                      )}
                      {teil.bestellt_am && (
                        <span className="text-xs text-gray-400">Bestellt: {formatDate(teil.bestellt_am)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fahrzeug */}
                {teil.auftrag?.fahrzeug && (
                  <Link href={`/fahrzeuge/${teil.auftrag_id}`} className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-gray-500 hover:text-orange-600 group">
                    <Car className="w-3.5 h-3.5 flex-shrink-0 group-hover:text-orange-500" />
                    <span>{teil.auftrag.fahrzeug.marke} {teil.auftrag.fahrzeug.modell}</span>
                    <span className="font-mono">{teil.auftrag.fahrzeug.kennzeichen}</span>
                  </Link>
                )}
              </div>

              {/* Menge */}
              <div className="flex items-center gap-1">
                {teil.status === 'eingebaut' ? (
                  <span className="text-sm text-gray-400 px-2">{teil.menge}×</span>
                ) : (
                  <>
                    <button
                      onClick={() => handleMengeChange(teil.id, -1)}
                      disabled={teil.menge <= 1}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    {editingMenge === teil.id ? (
                      <input
                        type="number"
                        min={1}
                        defaultValue={teil.menge}
                        autoFocus
                        onBlur={e => { handleMengeSet(teil.id, e.target.value); setEditingMenge(null) }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { handleMengeSet(teil.id, (e.target as HTMLInputElement).value); setEditingMenge(null) }
                          if (e.key === 'Escape') setEditingMenge(null)
                        }}
                        className="w-12 text-center text-sm font-bold text-gray-900 border border-orange-400 rounded-lg px-1 py-1 focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingMenge(teil.id)}
                        className="w-10 text-center text-sm font-bold text-gray-900 hover:text-orange-600 cursor-pointer"
                        title="Klicken zum Bearbeiten"
                      >
                        {teil.menge}×
                      </button>
                    )}
                    <button
                      onClick={() => handleMengeChange(teil.id, +1)}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-400 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>

              {/* Rechte Seite: Haupt-Aktion oder Status-Badge */}
              <div className="flex items-center gap-2 sm:ml-2">
                {action && teil.status !== 'eingebaut' && tabMatchesStatus(tab === 'aktiv' ? tab : tab, teil.status as TeilStatus) ? (
                  // Im "Aktiv"-Tab zeige kontextabhängige Buttons
                  tab === 'aktiv' ? (
                    <ActiveTabAction teil={teil} onStatusChange={handleStatusChange} />
                  ) : (
                    <button
                      onClick={() => handleStatusChange(teil.id, action.nextStatus)}
                      className={cn(
                        'flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-colors whitespace-nowrap',
                        action.color
                      )}
                    >
                      <action.icon className="w-4 h-4" />
                      {action.label}
                    </button>
                  )
                ) : (
                  tab === 'aktiv' && teil.status !== 'eingebaut' ? (
                    <ActiveTabAction teil={teil} onStatusChange={handleStatusChange} />
                  ) : (
                    <span className={cn(
                      'text-xs px-3 py-1.5 rounded-full border font-medium',
                      TEIL_STATUS_COLOR[teil.status as TeilStatus]
                    )}>
                      {TEIL_STATUS_LABEL[teil.status as TeilStatus]}
                    </span>
                  )
                )}

                {teil.auftrag_id && (
                  <Link href={`/fahrzeuge/${teil.auftrag_id}`}>
                    <ChevronRight className="w-4 h-4 text-gray-300 hover:text-orange-500" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Im "Aktiv"-Tab: zeige pro Teil den nächsten sinnvollen Schritt
function ActiveTabAction({ teil, onStatusChange }: { teil: any; onStatusChange: (id: string, status: TeilStatus) => void }) {
  if (teil.status === 'nicht_bestellt') return (
    <button
      onClick={() => onStatusChange(teil.id, 'bestellt')}
      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white transition-colors whitespace-nowrap"
    >
      <ShoppingCart className="w-3.5 h-3.5" />
      Bestellen
    </button>
  )
  if (teil.status === 'bestellt' || teil.status === 'unterwegs') return (
    <button
      onClick={() => onStatusChange(teil.id, 'geliefert')}
      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors whitespace-nowrap"
    >
      <PackageCheck className="w-3.5 h-3.5" />
      Angekommen ✓
    </button>
  )
  if (teil.status === 'geliefert') return (
    <button
      onClick={() => onStatusChange(teil.id, 'eingebaut')}
      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-green-500 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
    >
      <Wrench className="w-3.5 h-3.5" />
      Eingebaut ✓
    </button>
  )
  return (
    <span className={cn(
      'text-xs px-3 py-1.5 rounded-full border font-medium',
      TEIL_STATUS_COLOR[teil.status as TeilStatus]
    )}>
      {TEIL_STATUS_LABEL[teil.status as TeilStatus]}
    </span>
  )
}
