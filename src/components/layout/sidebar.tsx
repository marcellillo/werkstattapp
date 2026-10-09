'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Settings, LogOut, Users, ChevronDown, MoreHorizontal
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRollen } from '@/lib/rollen-context'
import { useBetrieb } from '@/lib/betrieb-context'
import { useBenachrichtigungenAnzahl } from '@/hooks/use-benachrichtigungen-anzahl'
import { NAV_HAUPT, NAV_MEHR, NAV_ALLE_MEHR, sichtbar, type NavItem } from '@/lib/nav-config'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { kannZugreifen, loading, isSuperAdmin } = useRollen()
  const { isFeatureEnabled, currentBetrieb, availableBetriebe, switchBetrieb } = useBetrieb()
  const benAnzahl = useBenachrichtigungenAnzahl()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const tab = useSearchParams().get('tab')
  const [mehrOffen, setMehrOffen] = useState(false)
  useEffect(() => {
    try { setMehrOffen(localStorage.getItem('nav-mehr-offen') === '1') } catch { /* Speicher nicht verfügbar */ }
  }, [])
  const sichtbarFn = (i: NavItem) => !loading && sichtbar(i, kannZugreifen, isFeatureEnabled)
  const hauptItems = NAV_HAUPT.filter(sichtbarFn)
  const mehrGruppen = NAV_MEHR
    .map(g => ({ ...g, items: g.items.filter(sichtbarFn) }))
    .filter(g => g.items.length > 0)
  // Ist man gerade auf einer Seite aus "Weitere Funktionen", bleibt der Bereich offen
  const mehrAktiv = NAV_ALLE_MEHR.some(i => sichtbarFn(i) && i.aktiv(pathname, tab))
  const mehrZeigen = mehrOffen || mehrAktiv
  function mehrUmschalten() {
    const neu = !mehrOffen
    setMehrOffen(neu)
    try { localStorage.setItem('nav-mehr-offen', neu ? '1' : '0') } catch { /* egal */ }
  }

  const navLink = ({ href, label, icon: Icon, badge, aktiv }: NavItem) => {
    const active = aktiv(pathname, tab)
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
          active ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        )}
      >
        <div className="relative flex-shrink-0">
          <Icon className="w-[18px] h-[18px]" />
          {badge === 'benachrichtigungen' && benAnzahl > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
              {benAnzahl > 99 ? '99+' : benAnzahl}
            </span>
          )}
        </div>
        <span className="flex-1 leading-none">{label}</span>
      </Link>
    )
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col h-full w-64 bg-slate-950 text-white">
      {/* Logo & Betrieb Selector */}
      <div className="px-5 py-5 border-b border-slate-800">
        {currentBetrieb?.logo_url ? (
          <img src={currentBetrieb.logo_url} alt={currentBetrieb.name} width={140} height={48} className="object-contain" />
        ) : (
          <div className="flex items-center justify-center w-full h-12 bg-slate-800 rounded-lg text-xs text-slate-400 font-medium">
            {currentBetrieb?.name || 'Betrieb'}
          </div>
        )}

        {/* Super-Admin Betrieb Dropdown */}
        {isSuperAdmin && availableBetriebe.length > 1 && (
          <div className="mt-3 relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-200 transition-colors"
            >
              <span className="truncate">{currentBetrieb?.name || 'Betrieb wählen'}</span>
              <ChevronDown className={cn('w-4 h-4 flex-shrink-0 ml-2 transition-transform', dropdownOpen && 'rotate-180')} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                {availableBetriebe.map(betrieb => (
                  <button
                    key={betrieb.id}
                    onClick={() => {
                      switchBetrieb(betrieb.id)
                      setDropdownOpen(false)
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2.5 text-sm transition-colors border-b border-slate-700 last:border-b-0 hover:bg-slate-700',
                      currentBetrieb?.id === betrieb.id ? 'bg-orange-500 text-white font-medium' : 'text-slate-300'
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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
        <div className="space-y-0.5">{hauptItems.map(navLink)}</div>

        {mehrGruppen.length > 0 && (
          <div className="pt-3 mt-3 border-t border-slate-800">
            <button
              onClick={mehrUmschalten}
              className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
              aria-expanded={mehrZeigen}
            >
              <MoreHorizontal className="w-[18px] h-[18px]" />
              <span className="flex-1 text-left">Weitere Funktionen</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', mehrZeigen && 'rotate-180')} />
            </button>
            {mehrZeigen && (
              <div className="mt-2 space-y-3">
                {mehrGruppen.map(g => (
                  <div key={g.label}>
                    <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 select-none">{g.label}</p>
                    <div className="space-y-0.5">{g.items.map(navLink)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Admin & Footer */}
      <div className="px-3 py-3 border-t border-slate-800 space-y-0.5">
        {kannZugreifen('admin') && (
          <>
            <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 select-none border-t border-slate-700 pt-2">
              Admin
            </p>
            <Link
              href="/mitarbeiter"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                pathname === '/mitarbeiter' || pathname.startsWith('/mitarbeiter/')
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <Users className="w-[18px] h-[18px]" />
              <span>Mitarbeiter</span>
            </Link>
          </>
        )}
        {kannZugreifen('einstellungen') && (
          <Link
            href="/einstellungen"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              pathname === '/einstellungen'
                ? 'bg-orange-500 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            )}
          >
            <Settings className="w-[18px] h-[18px]" />
            <span>Einstellungen</span>
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-950 hover:text-red-400 transition-all"
        >
          <LogOut className="w-[18px] h-[18px]" />
          <span>Abmelden</span>
        </button>
      </div>
    </aside>
  )
}
