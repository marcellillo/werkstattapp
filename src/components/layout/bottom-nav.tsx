'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Car, Layers, CalendarClock, Menu, X,
  Users, Package, Calendar, Bell, BarChart2, Mail, Settings,
  LogOut, Receipt, History, BookOpen, ShieldAlert, Wrench
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useRollen } from '@/lib/rollen-context'
import { useBenachrichtigungenAnzahl } from '@/hooks/use-benachrichtigungen-anzahl'

const mainItemDefs = [
  { href: '/dashboard',   label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/hebebuehnen', label: 'Bühnen',    icon: Layers,           key: 'hebebuehnen' },
  { href: '/fahrzeuge',   label: 'Fahrzeuge', icon: Car,              key: 'fahrzeuge' },
  { href: '/termine',     label: 'Termine',   icon: CalendarClock,    key: 'termine' },
]

const moreItemDefs = [
  { href: '/kunden',             label: 'Kunden',          icon: Users,    key: 'kunden' },
  { href: '/teile',              label: 'Lager',           icon: Package,  key: 'teile' },
  { href: '/tuev-wecker',         label: 'TÜV-Wecker',      icon: ShieldAlert, key: 'tuev_wecker' },
  { href: '/service-wecker',      label: 'Service-Wecker',  icon: Wrench,       key: 'service_wecker' },
  { href: '/kalender',           label: 'Kalender',        icon: Calendar, key: 'kalender' },
  { href: '/rechnungen',         label: 'Rechnungen',      icon: Receipt,  key: 'rechnungen' },
  { href: '/buchhaltung',        label: 'Buchhaltung',     icon: BookOpen, key: 'buchhaltung' },
  { href: '/emails',             label: 'E-Mails',         icon: Mail,     key: 'emails' },
  { href: '/verlauf',            label: 'Verlauf',         icon: History,  key: 'verlauf' },
  { href: '/statistiken',        label: 'Statistiken',     icon: BarChart2,key: 'statistiken' },
  { href: '/benachrichtigungen', label: 'Benachrichtigungen', icon: Bell,  key: 'benachrichtigungen' },
  { href: '/einstellungen',      label: 'Einstellungen',   icon: Settings, key: 'einstellungen' },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { kannZugreifen, loading } = useRollen()
  const benAnzahl = useBenachrichtigungenAnzahl()

  const mainItems = loading ? [] : mainItemDefs.filter(i => kannZugreifen(i.key))
  const moreItems = loading ? [] : moreItemDefs.filter(i => kannZugreifen(i.key))

  const isMoreActive = moreItems.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {drawerOpen && (
        <div className="fixed bottom-20 left-0 right-0 z-50 lg:hidden bg-white rounded-t-2xl shadow-2xl border-t border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="font-semibold text-gray-900">Mehr</span>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {moreItems.map(({ href, label, icon: Icon, key }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              const isBell = key === 'benachrichtigungen'
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setDrawerOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-colors',
                    active ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <div className="relative">
                    <Icon className="w-6 h-6" />
                    {isBell && benAnzahl > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                        {benAnzahl > 99 ? '99+' : benAnzahl}
                      </span>
                    )}
                  </div>
                  <span className="text-center leading-tight">{label}</span>
                </Link>
              )
            })}
            <button
              onClick={handleSignOut}
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-6 h-6" />
              <span>Abmelden</span>
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white border-t border-gray-200 safe-area-pb">
        <div className="flex items-stretch h-16">
          {mainItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 gap-1 text-xs font-medium transition-colors',
                  active ? 'text-orange-600' : 'text-gray-500'
                )}
              >
                <Icon className={cn('w-6 h-6', active && 'stroke-[2.5]')} />
                <span>{label}</span>
              </Link>
            )
          })}

          <button
            onClick={() => setDrawerOpen(v => !v)}
            className={cn(
              'flex flex-col items-center justify-center flex-1 gap-1 text-xs font-medium transition-colors',
              isMoreActive ? 'text-orange-600' : 'text-gray-500'
            )}
          >
            <Menu className="w-6 h-6" />
            <span>Mehr</span>
          </button>
        </div>
      </nav>
    </>
  )
}
