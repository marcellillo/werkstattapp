'use client'
import { Menu } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import { usePathname } from 'next/navigation'

interface TopbarProps {
  title: string
  onMenuClick?: () => void
}

const PAGE_SUBTITLES: Record<string, string> = {
  '/dashboard':          'Übersicht aller aktiven Fahrzeuge',
  '/fahrzeuge':          'Alle Aufträge verwalten',
  '/hebebuehnen':        'Hebebühnen-Belegung',
  '/teile':              'Ersatzteile & Lagerbestand',
  '/kalender':           'Fertigstellungstermine',
  '/termine':            'Kundenbesuche & Abgaben',
  '/kunden':             'Kundenstamm',
  '/einstellungen':      'App-Konfiguration',
  '/statistiken':        'Auswertungen',
  '/rechnungen':         'Rechnungsverwaltung',
  '/benachrichtigungen': 'Systemmeldungen',
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  const pathname = usePathname()
  const subtitle = PAGE_SUBTITLES[pathname] ?? ''

  return (
    <header className="flex items-center gap-4 px-6 bg-white border-b border-slate-200 h-16 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex flex-col justify-center min-w-0">
        <h1 className="font-semibold text-slate-900 text-base leading-tight truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs text-slate-400 leading-tight hidden sm:block">{subtitle}</p>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <NotificationBell />
        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
          W
        </div>
      </div>
    </header>
  )
}
