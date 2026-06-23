'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar, Car } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import {
  FAHRZEUG_STATUS_LABEL, FAHRZEUG_STATUS_COLOR, type FahrzeugStatus
} from '@/types/database'

type ViewMode = 'monat' | 'woche' | 'tag'

export function KalenderContent({ auftraege }: { auftraege: any[] }) {
  const [view, setView] = useState<ViewMode>('monat')
  const [currentDate, setCurrentDate] = useState(new Date())

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
      return `${formatDate(start)} – ${formatDate(end)}`
    }
    return currentDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  }

  function getAuftraegeForDate(date: Date) {
    const d = date.toISOString().split('T')[0]
    return auftraege.filter(a => a.geplante_fertigstellung === d)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kalender</h1>
          <p className="text-sm text-gray-800 mt-0.5">{auftraege.length} geplante Fertigstellungen</p>
        </div>
        {/* View Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {(['tag', 'woche', 'monat'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
                view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-800 hover:text-gray-700'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="font-semibold text-gray-800 text-sm md:text-base">{formatHeader()}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs text-orange-600 hover:text-orange-700 font-medium px-2 py-1 rounded hover:bg-orange-50"
          >
            Heute
          </button>
          <button onClick={() => navigate(1)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {view === 'monat' && (
        <MonthView currentDate={currentDate} auftraege={auftraege} getAuftraegeForDate={getAuftraegeForDate} />
      )}
      {view === 'woche' && (
        <WeekView currentDate={currentDate} getAuftraegeForDate={getAuftraegeForDate} />
      )}
      {view === 'tag' && (
        <DayView currentDate={currentDate} getAuftraegeForDate={getAuftraegeForDate} />
      )}

      {/* List of all upcoming */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-3">Alle geplanten Fertigstellungen</h3>
        {auftraege.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-800">Keine Termine geplant</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {auftraege.map(a => {
              const overdue = a.geplante_fertigstellung < new Date().toISOString().split('T')[0]
              return (
                <Link key={a.id} href={`/fahrzeuge/${a.id}`}>
                  <div className={cn(
                    'flex items-center gap-4 px-4 py-3 bg-white border rounded-lg hover:border-orange-300 transition-colors',
                    overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
                  )}>
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center flex-shrink-0',
                      overdue ? 'bg-red-100' : 'bg-orange-100'
                    )}>
                      <span className={cn('text-xs font-bold', overdue ? 'text-red-600' : 'text-orange-600')}>
                        {new Date(a.geplante_fertigstellung + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit' })}
                      </span>
                      <span className={cn('text-xs', overdue ? 'text-red-500' : 'text-orange-500')}>
                        {new Date(a.geplante_fertigstellung + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm">
                          {a.fahrzeug?.marke} {a.fahrzeug?.modell}
                        </p>
                        <span className="text-xs text-gray-600 font-mono">{a.fahrzeug?.kennzeichen}</span>
                      </div>
                      <p className="text-xs text-gray-800">{a.kunde?.vorname} {a.kunde?.nachname}</p>
                      {a.arbeiten && <p className="text-xs text-gray-600 mt-0.5 truncate">{a.arbeiten}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-xs border font-medium',
                        FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus]
                      )}>
                        {FAHRZEUG_STATUS_LABEL[a.status as FahrzeugStatus]}
                      </span>
                      {a.hebebuehne && (
                        <p className="text-xs text-gray-600 mt-1">{a.hebebuehne.bezeichnung}</p>
                      )}
                      {overdue && <p className="text-xs text-red-600 font-medium mt-1">âš  Überfällig</p>}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

function MonthView({ currentDate, auftraege, getAuftraegeForDate }: {
  currentDate: Date
  auftraege: any[]
  getAuftraegeForDate: (d: Date) => any[]
}) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const today = new Date().toISOString().split('T')[0]

  const days: (Date | null)[] = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))

  const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-600 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="min-h-[80px] border-r border-b border-gray-50" />
          const dateStr = day.toISOString().split('T')[0]
          const dayAuftraege = getAuftraegeForDate(day)
          const isToday = dateStr === today
          return (
            <div key={dateStr} className={cn(
              'min-h-[80px] p-1.5 border-r border-b border-gray-50 last:border-r-0',
              isToday ? 'bg-orange-50' : 'hover:bg-gray-50'
            )}>
              <span className={cn(
                'inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium mb-1',
                isToday ? 'bg-orange-500 text-white' : 'text-gray-800'
              )}>
                {day.getDate()}
              </span>
              {dayAuftraege.slice(0, 2).map(a => (
                <Link key={a.id} href={`/fahrzeuge/${a.id}`}>
                  <div className={cn(
                    'text-xs px-1.5 py-0.5 rounded truncate mb-0.5 font-medium',
                    FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus]
                  )}>
                    {a.fahrzeug?.kennzeichen}
                  </div>
                </Link>
              ))}
              {dayAuftraege.length > 2 && (
                <span className="text-xs text-gray-600">+{dayAuftraege.length - 2}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ currentDate, getAuftraegeForDate }: {
  currentDate: Date
  getAuftraegeForDate: (d: Date) => any[]
}) {
  const start = getWeekStart(currentDate)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); return d
  })
  const today = new Date().toISOString().split('T')[0]
  const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => {
        const dayAuftraege = getAuftraegeForDate(day)
        const dateStr = day.toISOString().split('T')[0]
        const isToday = dateStr === today
        return (
          <div key={dateStr} className={cn(
            'bg-white border rounded-xl p-2 min-h-[120px]',
            isToday ? 'border-orange-400' : 'border-gray-200'
          )}>
            <p className={cn('text-xs font-semibold mb-1.5', isToday ? 'text-orange-600' : 'text-gray-800')}>
              {WEEKDAYS[i]} {day.getDate()}
            </p>
            {dayAuftraege.map(a => (
              <Link key={a.id} href={`/fahrzeuge/${a.id}`}>
                <div className={cn(
                  'text-xs px-2 py-1 rounded-lg mb-1 font-medium truncate',
                  FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus]
                )}>
                  {a.fahrzeug?.marke} {a.fahrzeug?.modell}
                </div>
              </Link>
            ))}
            {dayAuftraege.length === 0 && (
              <p className="text-xs text-gray-200 text-center mt-4">—</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DayView({ currentDate, getAuftraegeForDate }: {
  currentDate: Date
  getAuftraegeForDate: (d: Date) => any[]
}) {
  const dayAuftraege = getAuftraegeForDate(currentDate)
  return (
    <div className="space-y-3">
      {dayAuftraege.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-800">Keine Termine an diesem Tag</p>
          </CardContent>
        </Card>
      ) : dayAuftraege.map(a => (
        <Link key={a.id} href={`/fahrzeuge/${a.id}`}>
          <Card className="hover:border-orange-300 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <Car className="w-8 h-8 text-orange-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{a.fahrzeug?.marke} {a.fahrzeug?.modell}</p>
                <p className="text-sm text-gray-800">{a.fahrzeug?.kennzeichen} · {a.kunde?.vorname} {a.kunde?.nachname}</p>
                {a.arbeiten && <p className="text-xs text-gray-600 mt-1">{a.arbeiten}</p>}
              </div>
              <span className={cn(
                'inline-flex px-3 py-1 rounded-full text-xs border font-medium',
                FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus]
              )}>
                {FAHRZEUG_STATUS_LABEL[a.status as FahrzeugStatus]}
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

