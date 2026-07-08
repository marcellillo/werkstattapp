'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Car, Users, Package, Calendar,
  Bell, Settings, LogOut, BarChart2,
  Mail, CalendarClock, Layers, Receipt, History, BookOpen,
  ShieldAlert, Wrench, ClipboardCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useRollen } from '@/lib/rollen-context'
import { useBenachrichtigungenAnzahl } from '@/hooks/use-benachrichtigungen-anzahl'

const navGroups = [
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
  const { kannZugreifen, loading } = useRollen()
  const benAnzahl = useBenachrichtigungenAnzahl()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col h-full w-64 bg-slate-950 text-white">
      {/* Logo */}
      <div className="flex items-center px-5 py-5 border-b border-slate-800">
        <img src="/logo-v.png" alt="Logo" width={140} height={48} className="object-contain" />
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

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-800 space-y-0.5">
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
