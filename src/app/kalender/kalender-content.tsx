'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar, Car, ShieldCheck, CalendarClock, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import { FAHRZEUG_STATUS_LABEL, FAHRZEUG_STATUS_COLOR, type FahrzeugStatus } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

type ViewMode = 'monat' | 'woche' | 'tag'

const TERMIN_TYP_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  tuev:      { label: 'TÜV',       color: 'bg-yellow-100 text-yellow-800 border-yellow-300', bg: 'bg-yellow-100', icon: ShieldCheck },
  werkstatt: { label: 'Werkstatt', color: 'bg-blue-100 text-blue-800 border-blue-300',       bg: 'bg-blue-100',   icon: CalendarClock },
  online:    { label: 'Online',    color: 'bg-purple-100 text-purple-800 border-purple-300', bg: 'bg-purple-100', icon: CalendarClock },
}

function getTerminCfg(typ: string) {
  return TERMIN_TYP_CFG[typ] ?? TERMIN_TYP_CFG['werkstatt']
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return d
}

// Heute + N Werktage (Wochenenden überspringen)
function addWerktage(tage: number): string {
  const d = new Date()
  let verbleibend = Math.ceil(tage)
  while (verbleibend > 0) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) verbleibend--
  }
  return d.toISOString().split('T')[0]
}

export function KalenderContent({ auftraege: initialAuftraege, termine = [] }: { auftraege: any[]; termine?: any[] }) {
  const [auftraege, setAuftraege] = useState(initialAuftraege)
  const [view, setView] = useState<ViewMode>('monat')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [settingDateFor, setSettingDateFor] = useState<string | null>(null)
  const supabase = createClient()

  const mitDatum   = auftraege.filter(a => a.geplante_fertigstellung)
  const ohneDatum  = auftraege.filter(a => !a.geplante_fertigstellung)
  const today      = new Date().toISOString().split('T')[0]
  const ueberfaellig = mitDatum.filter(a => a.geplante_fertigstellung < today)

  async function setFertigstellung(auftragId: string, datum: string) {
    setAuftraege(prev => prev.map(a => a.id === auftragId ? { ...a, geplante_fertigstellung: datum } : a))
    setSettingDateFor(null)
    await supabase.from('auftraege').update({ geplante_fertigstellung: datum }).eq('id', auftragId)
  }

  async function clearFertigstellung(auftragId: string) {
    setAuftraege(prev => prev.map(a => a.id === auftragId ? { ...a, geplante_fertigstellung: null } : a))
    await supabase.from('auftraege').update({ geplante_fertigstellung: null }).eq('id', auftragId)
  }

  function navigate(delta: number) {
    const d = new Date(currentDate)
    if (view === 'monat') d.setMonth(d.getMonth() + delta)
    else if (view === 'woche') d.setDate(d.getDate() + delta * 7)
    else d.setDate(d.getDate() + delta)
    setCurrentDate(d)
  }

  const formatHeader = () => {
    if (view === 'monat') return currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    if (view === 'woche') {
      const start = getWeekStart(currentDate)
      const end = new Date(start); end.setDate(end.getDate() + 6)
      return `${formatDate(start.toISOString().split('T')[0])} – ${formatDate(end.toISOString().split('T')[0])}`
    }
    return currentDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  }

  function getAuftraegeForDate(date: Date) {
    const d = date.toISOString().split('T')[0]
    return auftraege.filter(a => a.geplante_fertigstellung === d)
  }
  function getTermineForDate(date: Date) {
    const d = date.toISOString().split('T')[0]
    return termine.filter(t => t.datum === d)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kalender</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {mitDatum.length} geplante Fertigstellungen · {termine.length} Termine
            {ueberfaellig.length > 0 && <span className="ml-2 text-red-600 font-medium">· {ueberfaellig.length} überfällig</span>}
          </p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {(['tag', 'woche', 'monat'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
                view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-700')}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Legende */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5 text-gray-500"><span className="w-3 h-3 rounded-sm bg-orange-200 inline-block" /> Fertigstellung</span>
        <span className="flex items-center gap-1.5 text-gray-500"><span className="w-3 h-3 rounded-sm bg-red-200 inline-block" /> Überfällig</span>
        <span className="flex items-center gap-1.5 text-gray-500"><span className="w-3 h-3 rounded-sm bg-blue-200 inline-block" /> Werkstatttermin</span>
        <span className="flex items-center gap-1.5 text-gray-500"><span className="w-3 h-3 rounded-sm bg-yellow-200 inline-block" /> TÜV</span>
      </div>

      {/* Überfällig-Banner */}
      {ueberfaellig.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">{ueberfaellig.length} {ueberfaellig.length === 1 ? 'Fahrzeug ist' : 'Fahrzeuge sind'} überfällig</p>
            <div className="mt-1 space-y-0.5">
              {ueberfaellig.map(a => (
                <Link key={a.id} href={`/fahrzeuge/${a.id}`} className="flex items-center gap-2 text-xs text-red-700 hover:text-red-900">
                  <Car className="w-3 h-3" />
                  {a.fahrzeug?.marke} {a.fahrzeug?.modell} · {a.fahrzeug?.kennzeichen}
                  <span className="font-mono opacity-70">— geplant: {formatDate(a.geplante_fertigstellung)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="font-semibold text-gray-800 text-sm md:text-base">{formatHeader()}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date())} className="text-xs text-orange-600 hover:text-orange-700 font-medium px-2 py-1 rounded hover:bg-orange-50">
            Heute
          </button>
          <button onClick={() => navigate(1)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Calendar Views */}
      {view === 'monat' && <MonthView currentDate={currentDate} getAuftraegeForDate={getAuftraegeForDate} getTermineForDate={getTermineForDate} />}
      {view === 'woche' && <WeekView currentDate={currentDate} getAuftraegeForDate={getAuftraegeForDate} getTermineForDate={getTermineForDate} />}
      {view === 'tag'   && <DayView  currentDate={currentDate} getAuftraegeForDate={getAuftraegeForDate} getTermineForDate={getTermineForDate} />}

      {/* Ohne Termin */}
      {ohneDatum.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-yellow-500" />
            <h3 className="text-base font-semibold text-gray-800">Noch kein Fertigstellungstermin</h3>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">{ohneDatum.length}</span>
          </div>
          <div className="space-y-2">
            {ohneDatum.map(a => (
              <div key={a.id} className="bg-white border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-4">
                <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/fahrzeuge/${a.id}`} className="font-medium text-gray-900 text-sm hover:text-orange-600">
                    {a.fahrzeug?.marke} {a.fahrzeug?.modell}
                  </Link>
                  <p className="text-xs text-gray-500 font-mono">{a.fahrzeug?.kennzeichen}{a.kunde ? ` · ${a.kunde.vorname} ${a.kunde.nachname}` : ''}</p>
                  {a.arbeiten && <p className="text-xs text-gray-400 truncate mt-0.5">{a.arbeiten}</p>}
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0', FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus])}>
                  {FAHRZEUG_STATUS_LABEL[a.status as FahrzeugStatus]}
                </span>
                <div className="flex-shrink-0">
                  {settingDateFor === a.id ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          min={today}
                          defaultValue={a.geschaetzte_dauer_tage ? addWerktage(a.geschaetzte_dauer_tage) : today}
                          autoFocus
                          className="border border-orange-400 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          onKeyDown={e => { if (e.key === 'Escape') setSettingDateFor(null) }}
                          onChange={e => { if (e.target.value) setFertigstellung(a.id, e.target.value) }}
                        />
                        <button onClick={() => setSettingDateFor(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                      {a.geschaetzte_dauer_tage && (
                        <button
                          onClick={() => setFertigstellung(a.id, addWerktage(a.geschaetzte_dauer_tage))}
                          className="text-xs text-orange-600 hover:text-orange-800"
                        >
                          Vorschlag: {formatDate(addWerktage(a.geschaetzte_dauer_tage))} ({a.geschaetzte_dauer_tage} {a.geschaetzte_dauer_tage === 1 ? 'Tag' : 'Tage'}) übernehmen
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => setSettingDateFor(a.id)}
                        className="flex items-center gap-1.5 text-xs bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Termin setzen
                      </button>
                      {a.geschaetzte_dauer_tage && (
                        <span className="text-xs text-gray-400">ca. {a.geschaetzte_dauer_tage} {a.geschaetzte_dauer_tage === 1 ? 'Tag' : 'Tage'}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alle geplanten Fertigstellungen & Termine */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          Geplante Fertigstellungen &amp; Termine
        </h3>
        {mitDatum.length === 0 && termine.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500">Keine Termine geplant</p>
              <p className="text-xs text-gray-400 mt-1">Setze bei jedem Fahrzeug oben einen Termin</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {/* Termine */}
            {termine.map(t => {
              const cfg = getTerminCfg(t.typ)
              const Icon = cfg.icon
              return (
                <Link key={`termin-${t.id}`} href="/termine">
                  <div className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-colors">
                    <div className={cn('w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center flex-shrink-0', cfg.bg)}>
                      <span className="text-xs font-bold text-gray-700">{new Date(t.datum + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit' })}</span>
                      <span className="text-xs text-gray-500">{new Date(t.datum + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' })}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <p className="font-medium text-gray-900 text-sm truncate">{t.titel}</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {t.uhrzeit ? `${t.uhrzeit.slice(0,5)} Uhr` : 'Ganztägig'}
                        {t.dauer_minuten ? ` · ${t.dauer_minuten} Min.` : ''}
                        {t.fahrzeug?.kennzeichen ? ` · ${t.fahrzeug.kennzeichen}` : ''}
                        {t.kunde?.nachname ? ` · ${t.kunde.vorname} ${t.kunde.nachname}` : ''}
                      </p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0', cfg.color)}>{cfg.label}</span>
                  </div>
                </Link>
              )
            })}

            {/* Fahrzeug-Fertigstellungen */}
            {[...mitDatum].sort((a, b) => (a.geplante_fertigstellung ?? '').localeCompare(b.geplante_fertigstellung ?? '')).map(a => {
              const overdue = a.geplante_fertigstellung < today
              return (
                <div key={`auftrag-${a.id}`} className={cn(
                  'flex items-center gap-4 px-4 py-3 bg-white border rounded-xl transition-colors',
                  overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
                )}>
                  <div className={cn('w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center flex-shrink-0', overdue ? 'bg-red-100' : 'bg-orange-100')}>
                    <span className={cn('text-xs font-bold', overdue ? 'text-red-600' : 'text-orange-600')}>
                      {new Date(a.geplante_fertigstellung + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit' })}
                    </span>
                    <span className={cn('text-xs', overdue ? 'text-red-500' : 'text-orange-500')}>
                      {new Date(a.geplante_fertigstellung + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' })}
                    </span>
                  </div>
                  <Link href={`/fahrzeuge/${a.id}`} className="flex-1 min-w-0 hover:text-orange-600">
                    <div className="flex items-center gap-2">
                      <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <p className="font-medium text-gray-900 text-sm">{a.fahrzeug?.marke} {a.fahrzeug?.modell}</p>
                      <span className="text-xs text-gray-500 font-mono">{a.fahrzeug?.kennzeichen}</span>
                    </div>
                    <p className="text-xs text-gray-500">{a.kunde?.vorname} {a.kunde?.nachname}</p>
                    {a.arbeiten && <p className="text-xs text-gray-400 mt-0.5 truncate">{a.arbeiten}</p>}
                  </Link>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs border font-medium', FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus])}>
                      {FAHRZEUG_STATUS_LABEL[a.status as FahrzeugStatus]}
                    </span>
                    {overdue && <span className="text-xs text-red-600 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Überfällig</span>}
                    <button
                      onClick={() => clearFertigstellung(a.id)}
                      className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                      title="Termin entfernen"
                    >
                      Termin entfernen
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Month View ──────────────────────────────────────────────────────────────
function MonthView({ currentDate, getAuftraegeForDate, getTermineForDate }: {
  currentDate: Date; getAuftraegeForDate: (d: Date) => any[]; getTermineForDate: (d: Date) => any[]
}) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const today = new Date().toISOString().split('T')[0]
  const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  const days: (Date | null)[] = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map(d => <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="min-h-[80px] border-r border-b border-gray-50" />
          const dateStr = day.toISOString().split('T')[0]
          const dayAuftraege = getAuftraegeForDate(day)
          const dayTermine   = getTermineForDate(day)
          const isToday = dateStr === today
          const hasOverdue = dayAuftraege.some(a => a.geplante_fertigstellung < today)
          const total = dayAuftraege.length + dayTermine.length
          return (
            <div key={dateStr} className={cn('min-h-[80px] p-1.5 border-r border-b border-gray-50 last:border-r-0', isToday ? 'bg-orange-50' : 'hover:bg-gray-50/50')}>
              <span className={cn('inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium mb-1',
                isToday ? 'bg-orange-500 text-white' : hasOverdue ? 'text-red-600 font-bold' : 'text-gray-700')}>
                {day.getDate()}
              </span>
              {dayTermine.slice(0, 1).map(t => {
                const cfg = getTerminCfg(t.typ)
                return (
                  <Link key={t.id} href="/termine">
                    <div className={cn('text-xs px-1.5 py-0.5 rounded truncate mb-0.5 font-medium border', cfg.color)}>
                      {t.uhrzeit ? t.uhrzeit.slice(0,5) + ' ' : ''}{t.titel}
                    </div>
                  </Link>
                )
              })}
              {dayAuftraege.slice(0, dayTermine.length > 0 ? 1 : 2).map(a => {
                const overdue = a.geplante_fertigstellung < today
                return (
                  <Link key={a.id} href={`/fahrzeuge/${a.id}`}>
                    <div className={cn('text-xs px-1.5 py-0.5 rounded truncate mb-0.5 font-medium border',
                      overdue ? 'bg-red-100 text-red-700 border-red-300' : FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus])}>
                      {a.fahrzeug?.kennzeichen}
                    </div>
                  </Link>
                )
              })}
              {total > 2 && <span className="text-xs text-gray-400">+{total - 2}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week View ───────────────────────────────────────────────────────────────
function WeekView({ currentDate, getAuftraegeForDate, getTermineForDate }: {
  currentDate: Date; getAuftraegeForDate: (d: Date) => any[]; getTermineForDate: (d: Date) => any[]
}) {
  const start = getWeekStart(currentDate)
  const days  = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
  const today = new Date().toISOString().split('T')[0]
  const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => {
        const dayAuftraege = getAuftraegeForDate(day)
        const dayTermine   = getTermineForDate(day)
        const dateStr = day.toISOString().split('T')[0]
        const isToday = dateStr === today
        return (
          <div key={dateStr} className={cn('bg-white border rounded-xl p-2 min-h-[120px]', isToday ? 'border-orange-400' : 'border-gray-200')}>
            <p className={cn('text-xs font-semibold mb-1.5', isToday ? 'text-orange-600' : 'text-gray-700')}>
              {WEEKDAYS[i]} {day.getDate()}
            </p>
            {dayTermine.map(t => {
              const cfg = getTerminCfg(t.typ)
              return (
                <Link key={t.id} href="/termine">
                  <div className={cn('text-xs px-2 py-1 rounded-lg mb-1 font-medium truncate border', cfg.color)}>
                    {t.uhrzeit ? t.uhrzeit.slice(0,5) + ' ' : ''}{t.titel}
                  </div>
                </Link>
              )
            })}
            {dayAuftraege.map(a => {
              const overdue = a.geplante_fertigstellung < today
              return (
                <Link key={a.id} href={`/fahrzeuge/${a.id}`}>
                  <div className={cn('text-xs px-2 py-1 rounded-lg mb-1 font-medium truncate border',
                    overdue ? 'bg-red-100 text-red-700 border-red-300' : FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus])}>
                    {a.fahrzeug?.marke} {a.fahrzeug?.modell}
                    {overdue && ' ⚠'}
                  </div>
                </Link>
              )
            })}
            {dayAuftraege.length === 0 && dayTermine.length === 0 && (
              <p className="text-xs text-gray-200 text-center mt-4">—</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Day View ────────────────────────────────────────────────────────────────
function DayView({ currentDate, getAuftraegeForDate, getTermineForDate }: {
  currentDate: Date; getAuftraegeForDate: (d: Date) => any[]; getTermineForDate: (d: Date) => any[]
}) {
  const dayAuftraege = getAuftraegeForDate(currentDate)
  const dayTermine   = getTermineForDate(currentDate)
  const today        = new Date().toISOString().split('T')[0]

  if (dayAuftraege.length === 0 && dayTermine.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-gray-500">Keine Einträge an diesem Tag</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {dayTermine.map(t => {
        const cfg = getTerminCfg(t.typ)
        const Icon = cfg.icon
        return (
          <Link key={t.id} href="/termine">
            <Card className={cn('hover:border-blue-300 transition-colors border',
              cfg.color.includes('yellow') ? 'border-yellow-200' : cfg.color.includes('purple') ? 'border-purple-200' : 'border-blue-200')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', cfg.bg)}>
                  <Icon className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{t.titel}</p>
                  <p className="text-sm text-gray-500">
                    {t.uhrzeit ? `${t.uhrzeit.slice(0,5)} Uhr` : 'Ganztägig'}
                    {t.dauer_minuten ? ` · ${t.dauer_minuten} Min.` : ''}
                  </p>
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0', cfg.color)}>{cfg.label}</span>
              </CardContent>
            </Card>
          </Link>
        )
      })}
      {dayAuftraege.map(a => {
        const overdue = a.geplante_fertigstellung < today
        return (
          <Link key={a.id} href={`/fahrzeuge/${a.id}`}>
            <Card className={cn('hover:border-orange-300 transition-colors', overdue && 'border-red-200')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', overdue ? 'bg-red-100' : 'bg-orange-100')}>
                  <Car className={cn('w-5 h-5', overdue ? 'text-red-500' : 'text-orange-500')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{a.fahrzeug?.marke} {a.fahrzeug?.modell}</p>
                  <p className="text-sm text-gray-500">{a.fahrzeug?.kennzeichen}{a.kunde ? ` · ${a.kunde.vorname} ${a.kunde.nachname}` : ''}</p>
                  {a.arbeiten && <p className="text-xs text-gray-400 mt-1">{a.arbeiten}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={cn('inline-flex px-3 py-1 rounded-full text-xs border font-medium', FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus])}>
                    {FAHRZEUG_STATUS_LABEL[a.status as FahrzeugStatus]}
                  </span>
                  {overdue && <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1 justify-end"><AlertTriangle className="w-3 h-3" />Überfällig</p>}
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
