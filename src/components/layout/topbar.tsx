'use client'
import { Menu, ChevronDown } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import { GlobalSearch } from './global-search'
import { usePathname } from 'next/navigation'
import { useBetrieb } from '@/lib/betrieb-context'
import { useState } from 'react'
import { cn } from '@/lib/utils'

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
  const { currentBetrieb, availableBetriebe, switchBetrieb, isLoading } = useBetrieb()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <header className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 bg-white border-b border-slate-200 flex-shrink-0 topbar-safe">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 flex-shrink-0"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex flex-col justify-center min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-slate-900 text-sm sm:text-base leading-tight truncate">{title}</h1>
          {!isLoading && availableBetriebe.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors text-xs sm:text-sm text-slate-600"
              >
                <span className="font-medium">{currentBetrieb?.name || 'Betrieb'}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  {availableBetriebe.map(betrieb => (
                    <button
                      key={betrieb.id}
                      onClick={() => {
                        switchBetrieb(betrieb.id)
                        setDropdownOpen(false)
                      }}
                      className={cn(
                        'w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors',
                        currentBetrieb?.id === betrieb.id && 'bg-blue-50 text-blue-600 font-medium'
                      )}
                    >
                      {betrieb.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-400 leading-tight hidden sm:block">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        <GlobalSearch />
        <NotificationBell />
        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
          W
        </div>
      </div>
    </header>
  )
}
