'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Car, Users, Package, Calendar,
  Bell, Settings, LogOut, BarChart2,
  Mail, CalendarClock, Layers, Receipt, History, BookOpen,
  ShieldAlert, Wrench, ClipboardCheck, Lock, ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useRollen } from '@/lib/rollen-context'
import { useBetrieb } from '@/lib/betrieb-context'
import { useBenachrichtigungenAnzahl } from '@/hooks/use-benachrichtigungen-anzahl'

const navGroupsTemplate = [
  {
    label: 'Tagesbetrieb',
    items: [
      { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard, key: 'dashboard' },
      { href: '/hebebuehnen', label: 'Hebebühnen',  icon: Layers,          key: 'hebebuehnen' },
      { href: '/annahme',     label: 'Annahme',     icon: ClipboardCheck,  key: 'annahme' },
      { href: '/fahrzeuge',   label: 'Fahrzeuge',   icon: Car,             key: 'fahrzeuge' },
      { href: '/termine',     label: 'Termine',     icon: CalendarClock,   key: 'termine' },
    ],
  },
  {
    label: 'Eigenfahrzeuge',
    items: [
      { href: '/fahrzeuge/bestand',    label: '📥 Bestand-Import',      icon: Package, key: 'fahrzeuge' },
      { href: '/fahrzeuge/verkauft',   label: '💰 Verkaufte Fahrzeuge', icon: Package, key: 'fahrzeuge' },
      { href: '/fahrzeuge/uebergeben', label: '✅ Übergeben',           icon: Package, key: 'fahrzeuge' },
    ],
  },
  {
    label: 'Kunden & Lager',
    items: [
      { href: '/kunden', label: 'Kunden', icon: Users,   key: 'kunden' },
      { href: '/teile',  label: 'Lager',  icon: Package, key: 'teile' },
    ],
  },
  {
    label: 'Wecker',
    items: [
      { href: '/tuev-wecker',    label: 'TÜV-Wecker',    icon: ShieldAlert, key: 'tuev_wecker' },
      { href: '/service-wecker', label: 'Service-Wecker', icon: Wrench,      key: 'service_wecker' },
      { href: '/kalender',       label: 'Kalender',       icon: Calendar,    key: 'kalender' },
    ],
  },
  {
    label: 'Finanzen',
    items: [
      { href: '/rechnungen',  label: 'Rechnungen',  icon: Receipt,  key: 'rechnungen' },
      { href: '/buchhaltung', label: 'Buchhaltung', icon: BookOpen, key: 'buchhaltung' },
    ],
  },
  {
    label: 'Kommunikation',
    items: [
      { href: '/emails',             label: 'E-Mails',            icon: Mail,     key: 'emails' },
      { href: '/benachrichtigungen', label: 'Benachrichtigungen', icon: Bell,     key: 'benachrichtigungen' },
    ],
  },
  {
    label: 'Auswertung',
    items: [
      { href: '/statistiken', label: 'Statistiken', icon: BarChart2, key: 'statistiken' },
      { href: '/verlauf',     label: 'Verlauf',     icon: History,   key: 'verlauf' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { kannZugreifen, loading, isSuperAdmin } = useRollen()
  const { isFeatureEnabled, currentBetrieb, availableBetriebe, switchBetrieb } = useBetrieb()
  const benAnzahl = useBenachrichtigungenAnzahl()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Filter navGroups basierend auf enabled Features
  // Note: Einstellungen & Admin sind immer sichtbar (werden nicht gefiltert)
  const navGroups = navGroupsTemplate.filter(group => {
    // Immer anzeigen
    if (group.label === 'Kunden & Lager') return true
    if (group.label === 'Finanzen') return true // Immer anzeigen
    if (group.label === 'Auswertung') return true // Immer anzeigen
    if (group.label === 'Wecker' && group.items.some(i => i.key === 'kalender')) {
      return isFeatureEnabled('kalender') || group.items.some(i => i.key !== 'kalender')
    }
    return true
  }).map(group => {
    if (group.label === 'Wecker') {
      return {
        ...group,
        items: group.items.filter(item =>
          item.key !== 'kalender' || isFeatureEnabled('kalender')
        )
      }
    }
    if (group.label === 'Kunden & Lager') {
      return {
        ...group,
        items: group.items.filter(item =>
          item.label !== 'Lager' || isFeatureEnabled('teile_bestellen')
        )
      }
    }
    return group
  })

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
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {navGroups.map(group => {
          const visibleItems = loading ? [] : group.items.filter(i => kannZugreifen(i.key))
          if (visibleItems.length === 0) return null
          return (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 select-none border-t border-slate-800 pt-3">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(({ href, label, icon: Icon, key }) => {
                  const active = pathname === href || pathname.startsWith(href + '/')
                  const isBell = key === 'benachrichtigungen'
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                        active
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                      )}
                    >
                      <div className="relative flex-shrink-0">
                        <Icon className="w-[18px] h-[18px]" />
                        {isBell && benAnzahl > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                            {benAnzahl > 99 ? '99+' : benAnzahl}
                          </span>
                        )}
                      </div>
                      <span className="flex-1 leading-none">{label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
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
            <Link
              href="/admin/betrieb-features"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                pathname === '/admin/betrieb-features' || pathname.startsWith('/admin/betrieb-features/')
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <Lock className="w-[18px] h-[18px]" />
              <span>Features</span>
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
