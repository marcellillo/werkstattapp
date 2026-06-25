'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Wrench, Search, Phone, Mail, Car, AlertTriangle, CheckCircle,
  Clock, ChevronRight, MessageCircle, Calendar, X, Check,
  WrenchIcon,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

type Filter = 'alle' | 'ueberfaellig' | 'kritisch' | 'bald' | 'kein_termin' | 'ok'

function getDaysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getDaysSince(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const past = new Date(dateStr + 'T00:00:00')
  return Math.ceil((today.getTime() - past.getTime()) / (1000 * 60 * 60 * 24))
}

function getNextStatus(days: number | null): {
  label: string; color: string; bg: string; border: string; dot: string
} {
  if (days === null) return {
    label: 'Kein Termin', color: 'text-gray-500', bg: 'bg-white',
    border: 'border-gray-200', dot: 'bg-gray-300',
  }
  if (days < 0)    return { label: 'Überfällig',  color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500' }
  if (days <= 30)  return { label: 'Kritisch',    color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' }
  if (days <= 60)  return { label: 'Bald fällig', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500' }
  return               { label: 'OK',            color: 'text-green-700',  bg: 'bg-white',     border: 'border-gray-200',   dot: 'bg-green-500' }
}

function formatDays(days: number): string {
  if (days < 0)   return `${Math.abs(days)} Tage überfällig`
  if (days === 0) return 'Heute fällig'
  if (days === 1) return 'Morgen fällig'
  if (days <= 60) return `in ${days} Tagen`
  const months = Math.floor(days / 30)
  return `in ca. ${months} Monat${months > 1 ? 'en' : ''}`
}

function waService(telefon: string, kennzeichen: string): string {
  const clean = telefon.replace(/\s+/g, '').replace(/^0/, '49')
  const text = encodeURIComponent(
    `Guten Tag,\n\nfür Ihr Fahrzeug (${kennzeichen}) steht der nächste Service an.\n\nGerne vereinbaren wir einen Termin für Sie. Wann passt es Ihnen?\n\nMit freundlichen Grüßen\nIhre Kfz-Werkstatt`
  )
  return `https://wa.me/${clean}?text=${text}`
}

export function ServiceWeckerContent({ fahrzeuge: initialFahrzeuge }: { fahrzeuge: any[] }) {
  const supabase = createClient()
  const [fahrzeuge, setFahrzeuge] = useState(initialFahrzeuge)
  const [filter, setFilter] = useState<Filter>('alle')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDatum, setEditDatum] = useState('')
  const [saving, setSaving] = useState(false)
  const [creatingTermin, setCreatingTermin] = useState<string | null>(null)
  const [terminErstelltIds, setTerminErstelltIds] = useState<Set<string>>(new Set())

  const today = new Date().toISOString().split('T')[0]

  // Bereichnet Days-Until pro Fahrzeug
  const mitStatus = useMemo(() => fahrzeuge.map(f => {
    const days = f.naechster_service_datum ? getDaysUntil(f.naechster_service_datum) : null
    return { ...f, days }
  }), [fahrzeuge])

  const ueberfaellig  = mitStatus.filter(f => f.days !== null && f.days < 0)
  const kritisch      = mitStatus.filter(f => f.days !== null && f.days >= 0 && f.days <= 30)
  const bald          = mitStatus.filter(f => f.days !== null && f.days > 30 && f.days <= 60)
  const keinTermin    = mitStatus.filter(f => f.days === null)
  const ok            = mitStatus.filter(f => f.days !== null && f.days > 60)

  const filtered = mitStatus.filter(f => {
    if (filter === 'ueberfaellig' && (f.days === null || f.days >= 0)) return false
    if (filter === 'kritisch'    && (f.days === null || f.days < 0 || f.days > 30)) return false
    if (filter === 'bald'        && (f.days === null || f.days <= 30 || f.days > 60)) return false
    if (filter === 'kein_termin' && f.days !== null) return false
    if (filter === 'ok'          && (f.days === null || f.days <= 60)) return false
    if (search) {
      const q = search.toLowerCase()
      return f.kennzeichen?.toLowerCase().includes(q) ||
        f.marke?.toLowerCase().includes(q) ||
        f.modell?.toLowerCase().includes(q) ||
        `${f.kunde?.vorname ?? ''} ${f.kunde?.nachname ?? ''}`.toLowerCase().includes(q) ||
        f.kunde?.telefon?.includes(q)
    }
    return true
  })

  async function saveServiceDatum(fahrzeugId: string, datum: string) {
    setSaving(true)
    setFahrzeuge(prev => prev.map(f =>
      f.id === fahrzeugId ? { ...f, naechster_service_datum: datum || null } : f
    ))
    await supabase.from('fahrzeuge')
      .update({ naechster_service_datum: datum || null })
      .eq('id', fahrzeugId)
    setEditingId(null)
    setSaving(false)
  }

  async function handleTerminErstellen(f: any) {
    if (!f.naechster_service_datum) return
    setCreatingTermin(f.id)
    await supabase.from('termine').insert({
      titel: `Service ${f.kennzeichen}`,
      datum: f.naechster_service_datum,
      typ: 'werkstatt',
      status: 'geplant',
      fahrzeug_id: f.id,
      kunde_id: f.kunde_id ?? null,
      beschreibung: `Nächster Service fällig am ${formatDate(f.naechster_service_datum)}`,
    })
    setTerminErstelltIds(prev => new Set([...prev, f.id]))
    setCreatingTermin(null)
  }

  const FILTER_TABS: { value: Filter; label: string; count: number }[] = [
    { value: 'alle',        label: 'Alle',          count: mitStatus.length },
    { value: 'ueberfaellig',label: 'Überfällig',    count: ueberfaellig.length },
    { value: 'kritisch',    label: '≤ 30 Tage',     count: kritisch.length },
    { value: 'bald',        label: '≤ 60 Tage',     count: bald.length },
    { value: 'kein_termin', label: 'Kein Termin',   count: keinTermin.length },
    { value: 'ok',          label: 'OK',             count: ok.length },
  ]

  const TAB_BADGE: Record<Filter, string> = {
    alle:        'bg-gray-100 text-gray-600',
    ueberfaellig:'bg-red-100 text-red-700',
    kritisch:    'bg-orange-100 text-orange-700',
    bald:        'bg-yellow-100 text-yellow-700',
    kein_termin: 'bg-gray-100 text-gray-500',
    ok:          'bg-green-100 text-green-700',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service-Wecker</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {mitStatus.length} Kundenfahrzeuge
            {ueberfaellig.length > 0 && <span className="ml-2 text-red-600 font-medium">· {ueberfaellig.length} überfällig</span>}
            {kritisch.length > 0 && <span className="ml-2 text-orange-600 font-medium">· {kritisch.length} kritisch</span>}
            {keinTermin.length > 0 && <span className="ml-2 text-gray-500">· {keinTermin.length} ohne Termin</span>}
          </p>
        </div>
        <Link href="/fahrzeuge" className="text-sm text-orange-500 hover:underline flex items-center gap-1">
          <Car className="w-4 h-4" /> Alle Fahrzeuge
        </Link>
      </div>

      {/* KPI Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={cn('rounded-xl border p-4', ueberfaellig.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200')}>
          <p className="text-xs text-gray-500 mb-1">Überfällig</p>
          <p className={cn('text-2xl font-bold', ueberfaellig.length > 0 ? 'text-red-600' : 'text-gray-900')}>{ueberfaellig.length}</p>
        </div>
        <div className={cn('rounded-xl border p-4', kritisch.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200')}>
          <p className="text-xs text-gray-500 mb-1">≤ 30 Tage</p>
          <p className={cn('text-2xl font-bold', kritisch.length > 0 ? 'text-orange-600' : 'text-gray-900')}>{kritisch.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Kein Termin</p>
          <p className="text-2xl font-bold text-gray-900">{keinTermin.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">OK</p>
          <p className="text-2xl font-bold text-green-600">{ok.length}</p>
        </div>
      </div>

      {/* Alarm-Banner */}
      {(ueberfaellig.length > 0 || kritisch.length > 0) && (
        <div className={cn(
          'rounded-xl p-4 flex items-start gap-3 border',
          ueberfaellig.length > 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
        )}>
          <AlertTriangle className={cn('w-5 h-5 flex-shrink-0 mt-0.5', ueberfaellig.length > 0 ? 'text-red-500' : 'text-orange-500')} />
          <div>
            <p className={cn('text-sm font-semibold', ueberfaellig.length > 0 ? 'text-red-800' : 'text-orange-800')}>
              {ueberfaellig.length > 0
                ? `${ueberfaellig.length} Fahrzeug${ueberfaellig.length > 1 ? 'e haben' : ' hat'} den Service-Termin überschritten`
                : `${kritisch.length} Fahrzeug${kritisch.length > 1 ? 'e' : ''} in weniger als 30 Tagen fällig`}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {[...ueberfaellig, ...kritisch].slice(0, 4).map(f =>
                `${f.kennzeichen}${f.kunde ? ` (${f.kunde.nachname})` : ''}`
              ).join(' · ')}
              {ueberfaellig.length + kritisch.length > 4 && ` · +${ueberfaellig.length + kritisch.length - 4} weitere`}
            </p>
          </div>
        </div>
      )}

      {/* Filter-Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTER_TABS.map(t => (
          <button key={t.value} onClick={() => setFilter(t.value)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0',
              filter === t.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}>
            {t.label}
            {t.count > 0 && (
              <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full',
                filter === t.value ? 'bg-white/20 text-white' : TAB_BADGE[t.value])}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Suche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Kennzeichen, Name, Marke …"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">
            {mitStatus.length === 0 ? 'Noch keine Kundenfahrzeuge vorhanden' : 'Keine Fahrzeuge in dieser Kategorie'}
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => {
            const st = getNextStatus(f.days)
            const isEditing = editingId === f.id
            const terminErstellt = terminErstelltIds.has(f.id)

            return (
              <div key={f.id} className={cn('border rounded-xl overflow-hidden transition-colors', st.border, st.bg)}>
                <div className="flex items-start gap-4 px-4 py-4">
                  {/* Status-Dot */}
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-0.5">
                    <div className={cn('w-3 h-3 rounded-full', st.dot)} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {/* Zeile 1: Fahrzeug + Status-Badge */}
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/fahrzeuge/${f.id}`} className="font-semibold text-gray-900 hover:text-orange-600 text-sm">
                          {f.marke} {f.modell}
                        </Link>
                        <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{f.kennzeichen}</span>
                        {f.baujahr && <span className="text-xs text-gray-400">{f.baujahr}</span>}
                        {f.days !== null && (
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                            f.days < 0    ? 'bg-red-100 text-red-700' :
                            f.days <= 30  ? 'bg-orange-100 text-orange-700' :
                            f.days <= 60  ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700')}>
                            {formatDays(f.days)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Zeile 2: Kunde */}
                    {f.kunde && (
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-sm text-gray-700 font-medium">{f.kunde.vorname} {f.kunde.nachname}</span>
                        {f.kunde.telefon && (
                          <a href={`tel:${f.kunde.telefon}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600">
                            <Phone className="w-3 h-3" /> {f.kunde.telefon}
                          </a>
                        )}
                        {f.kunde.email && (
                          <a href={`mailto:${f.kunde.email}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600">
                            <Mail className="w-3 h-3" /> {f.kunde.email}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Zeile 3: Letzter Service */}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {f.letzter_service ? (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          <span>Letzter Service bei uns: <strong>{formatDate(f.letzter_service.erstellt_am.split('T')[0])}</strong></span>
                          {f.letzter_service.arbeiten && (
                            <span className="text-gray-400 truncate max-w-32">· {f.letzter_service.arbeiten.split('\n')[0]}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
                          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Noch kein Service bei uns</span>
                        </div>
                      )}
                    </div>

                    {/* Zeile 4: Nächster Service + Aktionen */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {/* Nächster Service Datum */}
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editDatum}
                            min={today}
                            onChange={e => setEditDatum(e.target.value)}
                            autoFocus
                            className="border border-orange-400 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <button
                            onClick={() => saveServiceDatum(f.id, editDatum)}
                            disabled={saving}
                            className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 flex items-center justify-center text-white"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-500"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingId(f.id); setEditDatum(f.naechster_service_datum ?? '') }}
                          className={cn(
                            'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                            f.naechster_service_datum
                              ? 'bg-white border-orange-200 text-orange-700 hover:border-orange-400'
                              : 'bg-orange-50 border-orange-200 text-orange-600 hover:border-orange-400'
                          )}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          {f.naechster_service_datum
                            ? `Nächster: ${formatDate(f.naechster_service_datum)}`
                            : 'Service-Datum setzen'}
                        </button>
                      )}

                      {/* WhatsApp */}
                      {f.kunde?.telefon && f.naechster_service_datum && (
                        <a
                          href={waService(f.kunde.telefon, f.kennzeichen)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-medium px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                      )}

                      {/* Anrufen */}
                      {f.kunde?.telefon && (
                        <a href={`tel:${f.kunde.telefon}`}
                          className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-medium px-3 py-1.5 rounded-lg transition-colors">
                          <Phone className="w-3.5 h-3.5" /> Anrufen
                        </a>
                      )}

                      {/* Termin anlegen */}
                      {f.naechster_service_datum && !terminErstellt && (
                        <button
                          onClick={() => handleTerminErstellen(f)}
                          disabled={creatingTermin === f.id}
                          className="flex items-center gap-1.5 text-xs bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                        >
                          <WrenchIcon className="w-3.5 h-3.5" />
                          {creatingTermin === f.id ? 'Wird angelegt…' : 'Termin anlegen'}
                        </button>
                      )}
                      {terminErstellt && (
                        <span className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Termin angelegt
                        </span>
                      )}

                      {/* Fahrzeug öffnen */}
                      <Link href={`/fahrzeuge/${f.id}`}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 ml-auto transition-colors">
                        Auftrag <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
