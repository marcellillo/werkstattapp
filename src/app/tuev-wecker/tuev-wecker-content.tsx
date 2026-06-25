'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ShieldCheck, ShieldAlert, ShieldX, Search, Phone, Mail,
  Car, Calendar, AlertTriangle, CheckCircle, Clock, MessageCircle,
  ChevronRight, Bell,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

type Filter = 'alle' | 'ueberfaellig' | 'kritisch' | 'bald' | 'ok'

function getDaysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getStatus(days: number): { label: string; color: string; bg: string; border: string; icon: any } {
  if (days < 0)   return { label: 'Überfällig',   color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    icon: ShieldX }
  if (days <= 30) return { label: 'Kritisch',     color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', icon: ShieldAlert }
  if (days <= 60) return { label: 'Bald fällig',  color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200', icon: ShieldAlert }
  return              { label: 'OK',             color: 'text-green-700',  bg: 'bg-white',      border: 'border-gray-200',   icon: ShieldCheck }
}

function formatDays(days: number): string {
  if (days < 0)  return `${Math.abs(days)} Tage überfällig`
  if (days === 0) return 'Heute!'
  if (days === 1) return 'Morgen'
  if (days <= 30) return `in ${days} Tagen`
  if (days <= 60) return `in ${days} Tagen`
  const months = Math.floor(days / 30)
  return `in ca. ${months} Monat${months > 1 ? 'en' : ''}`
}

function waPhone(telefon: string, kennzeichen: string, hu: string): string {
  const clean = telefon.replace(/\s+/g, '').replace(/^0/, '49')
  const text = encodeURIComponent(
    `Guten Tag,\n\nIhr Fahrzeug (${kennzeichen}) hat am ${formatDate(hu)} den TÜV/HU-Termin.\n\nGerne kümmern wir uns um die Vorbereitung. Sollen wir einen Termin vereinbaren?\n\nMit freundlichen Grüßen\nIhre Kfz-Werkstatt`
  )
  return `https://wa.me/${clean}?text=${text}`
}

export function TuevWeckerContent({ fahrzeuge: initialFahrzeuge }: { fahrzeuge: any[] }) {
  const supabase = createClient()
  const [fahrzeuge, setFahrzeuge] = useState(initialFahrzeuge)
  const [filter, setFilter] = useState<Filter>('alle')
  const [search, setSearch] = useState('')
  const [anfragenId, setAnfragenId] = useState<string | null>(null)
  const [zugestimmtIds, setZugestimmtIds] = useState<Set<string>>(new Set())
  const [terminErstelltIds, setTerminErstelltIds] = useState<Set<string>>(new Set())
  const [creatingTermin, setCreatingTermin] = useState<string | null>(null)

  const heute = new Date().toISOString().split('T')[0]

  const mitDays = useMemo(() =>
    fahrzeuge.map(f => ({ ...f, days: getDaysUntil(f.naechste_hauptuntersuchung) })),
    [fahrzeuge]
  )

  const ueberfaellig = mitDays.filter(f => f.days < 0)
  const kritisch     = mitDays.filter(f => f.days >= 0 && f.days <= 30)
  const bald         = mitDays.filter(f => f.days > 30 && f.days <= 60)
  const ok           = mitDays.filter(f => f.days > 60)

  const filtered = mitDays.filter(f => {
    if (filter === 'ueberfaellig' && f.days >= 0) return false
    if (filter === 'kritisch' && (f.days < 0 || f.days > 30)) return false
    if (filter === 'bald' && (f.days <= 30 || f.days > 60)) return false
    if (filter === 'ok' && f.days <= 60) return false
    if (search) {
      const q = search.toLowerCase()
      return f.kennzeichen?.toLowerCase().includes(q) ||
        f.marke?.toLowerCase().includes(q) ||
        f.modell?.toLowerCase().includes(q) ||
        `${f.kunde?.vorname} ${f.kunde?.nachname}`.toLowerCase().includes(q) ||
        f.kunde?.telefon?.includes(q)
    }
    return true
  })

  async function handleTerminErstellen(f: any) {
    setCreatingTermin(f.id)
    await supabase.from('termine').insert({
      titel: `TÜV-Vorbereitung ${f.kennzeichen}`,
      datum: f.naechste_hauptuntersuchung,
      typ: 'tuev',
      status: 'geplant',
      fahrzeug_id: f.id,
      kunde_id: f.kunde_id ?? null,
      beschreibung: `HU/TÜV fällig am ${formatDate(f.naechste_hauptuntersuchung)}`,
    })
    setTerminErstelltIds(prev => new Set([...prev, f.id]))
    setAnfragenId(null)
    setCreatingTermin(null)
  }

  const FILTER_TABS: { value: Filter; label: string; count: number; color: string }[] = [
    { value: 'alle',        label: 'Alle',        count: mitDays.length,    color: 'text-gray-600' },
    { value: 'ueberfaellig',label: 'Überfällig',  count: ueberfaellig.length, color: 'text-red-600' },
    { value: 'kritisch',    label: '≤ 30 Tage',   count: kritisch.length,   color: 'text-orange-600' },
    { value: 'bald',        label: '≤ 60 Tage',   count: bald.length,       color: 'text-yellow-600' },
    { value: 'ok',          label: 'OK',           count: ok.length,         color: 'text-green-600' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TÜV-Wecker</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {mitDays.length} Fahrzeuge mit HU-Datum
            {ueberfaellig.length > 0 && <span className="ml-2 text-red-600 font-medium">· {ueberfaellig.length} überfällig</span>}
            {kritisch.length > 0 && <span className="ml-2 text-orange-600 font-medium">· {kritisch.length} kritisch</span>}
          </p>
        </div>
        <Link href="/fahrzeuge" className="text-sm text-orange-500 hover:underline flex items-center gap-1">
          <Car className="w-4 h-4" /> Alle Fahrzeuge
        </Link>
      </div>

      {/* Alarm-Banner */}
      {(ueberfaellig.length > 0 || kritisch.length > 0) && (
        <div className={cn(
          'rounded-xl p-4 flex items-start gap-3 border',
          ueberfaellig.length > 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
        )}>
          <AlertTriangle className={cn('w-5 h-5 flex-shrink-0 mt-0.5', ueberfaellig.length > 0 ? 'text-red-500' : 'text-orange-500')} />
          <div className="flex-1">
            <p className={cn('text-sm font-semibold', ueberfaellig.length > 0 ? 'text-red-800' : 'text-orange-800')}>
              {ueberfaellig.length > 0
                ? `${ueberfaellig.length} Fahrzeug${ueberfaellig.length > 1 ? 'e' : ''} mit abgelaufenem TÜV`
                : `${kritisch.length} Fahrzeug${kritisch.length > 1 ? 'e' : ''} mit TÜV in weniger als 30 Tagen`
              }
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
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0',
              filter === t.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                'text-xs font-bold px-1.5 py-0.5 rounded-full',
                filter === t.value
                  ? 'bg-white/20 text-white'
                  : t.value === 'ueberfaellig' ? 'bg-red-100 text-red-700'
                  : t.value === 'kritisch' ? 'bg-orange-100 text-orange-700'
                  : t.value === 'bald' ? 'bg-yellow-100 text-yellow-700'
                  : t.value === 'ok' ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Suche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Kennzeichen, Name, Marke …"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">
              {mitDays.length === 0
                ? 'Noch kein Fahrzeug mit HU-Datum hinterlegt'
                : 'Keine Fahrzeuge in dieser Kategorie'}
            </p>
            {mitDays.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Trage das HU-Datum beim jeweiligen Fahrzeug ein</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => {
            const st = getStatus(f.days)
            const Icon = st.icon

            return (
              <div key={f.id} className={cn('border rounded-xl transition-colors', st.border, st.bg)}>
                <div className="flex items-start gap-4 px-4 py-4">
                  {/* Status-Icon + Datum */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <Icon className={cn('w-6 h-6', st.color)} />
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-800 tabular-nums leading-none">
                        {new Date(f.naechste_hauptuntersuchung + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(f.naechste_hauptuntersuchung + 'T00:00:00').getFullYear()}
                      </p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/fahrzeuge/${f.id}`} className="font-semibold text-gray-900 hover:text-orange-600 text-sm">
                            {f.marke} {f.modell}
                          </Link>
                          <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{f.kennzeichen}</span>
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', st.color,
                            st.label === 'Überfällig' ? 'bg-red-100' :
                            st.label === 'Kritisch' ? 'bg-orange-100' :
                            st.label === 'Bald fällig' ? 'bg-yellow-100' : 'bg-green-100'
                          )}>
                            {formatDays(f.days)}
                          </span>
                        </div>

                        {/* Kunde */}
                        {f.kunde ? (
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-sm text-gray-700 font-medium">
                              {f.kunde.vorname} {f.kunde.nachname}
                            </span>
                            {f.kunde.telefon && (
                              <a href={`tel:${f.kunde.telefon}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 transition-colors">
                                <Phone className="w-3 h-3" /> {f.kunde.telefon}
                              </a>
                            )}
                            {f.kunde.email && (
                              <a href={`mailto:${f.kunde.email}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 transition-colors">
                                <Mail className="w-3 h-3" /> {f.kunde.email}
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">Kein Kunde hinterlegt</p>
                        )}
                      </div>
                    </div>

                    {/* Aktionen */}
                    <div className="mt-3 space-y-2">
                      {terminErstelltIds.has(f.id) ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-green-700 font-medium px-3 py-1.5 rounded-lg">
                            <CheckCircle className="w-3.5 h-3.5" /> Termin angelegt
                          </span>
                          <Link href={`/fahrzeuge/${f.id}`} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors ml-auto">
                            Fahrzeug <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      ) : anfragenId === f.id ? (
                        /* Anfrage-Panel */
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-semibold text-amber-800">Kunde kontaktieren &amp; Zustimmung einholen:</p>
                          <div className="flex flex-wrap gap-2">
                            {f.kunde?.telefon && (
                              <a href={waPhone(f.kunde.telefon, f.kennzeichen, f.naechste_hauptuntersuchung)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-medium px-3 py-1.5 rounded-lg transition-colors">
                                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                              </a>
                            )}
                            {f.kunde?.telefon && (
                              <a href={`tel:${f.kunde.telefon}`}
                                className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-medium px-3 py-1.5 rounded-lg transition-colors">
                                <Phone className="w-3.5 h-3.5" /> Anrufen
                              </a>
                            )}
                            {!f.kunde?.telefon && (
                              <span className="text-xs text-amber-700">Kein Telefon hinterlegt</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-amber-200">
                            {zugestimmtIds.has(f.id) ? (
                              <button onClick={() => handleTerminErstellen(f)} disabled={creatingTermin === f.id}
                                className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
                                <Calendar className="w-3.5 h-3.5" />
                                {creatingTermin === f.id ? 'Wird angelegt…' : 'Termin anlegen'}
                              </button>
                            ) : (
                              <button onClick={() => setZugestimmtIds(prev => new Set([...prev, f.id]))}
                                className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
                                <CheckCircle className="w-3.5 h-3.5" /> Kunde hat zugestimmt
                              </button>
                            )}
                            <button onClick={() => setAnfragenId(null)} className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1.5">
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Standard-Zeile */
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => setAnfragenId(f.id)}
                            className="flex items-center gap-1.5 text-xs bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-medium px-3 py-1.5 rounded-lg transition-colors">
                            <Bell className="w-3.5 h-3.5" /> Kunde anfragen
                          </button>
                          <Link href={`/fahrzeuge/${f.id}`} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors ml-auto">
                            Fahrzeug <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      )}
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
