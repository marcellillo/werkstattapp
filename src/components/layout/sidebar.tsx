'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Car, Users, Package, Calendar,
  Bell, Settings, LogOut, ChevronRight, BarChart2,
  Mail, CalendarClock, Layers, Receipt, History, BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useRollen } from '@/lib/rollen-context'
import Image from 'next/image'

const navItems = [
  { href: '/dashboard',         label: 'Dashboard',        icon: LayoutDashboard, key: 'dashboard' },
  { href: '/hebebuehnen',       label: 'Hebebühnen',        icon: Layers,          key: 'hebebuehnen' },
  { href: '/fahrzeuge',         label: 'Fahrzeuge',         icon: Car,             key: 'fahrzeuge' },
  { href: '/termine',           label: 'Termine',           icon: CalendarClock,   key: 'termine' },
  { href: '/kunden',            label: 'Kunden',            icon: Users,           key: 'kunden' },
  { href: '/teile',             label: 'Ersatzteile',       icon: Package,         key: 'teile' },
  { href: '/kalender',          label: 'Kalender',          icon: Calendar,        key: 'kalender' },
  { href: '/rechnungen',        label: 'Rechnungen',        icon: Receipt,         key: 'rechnungen' },
  { href: '/buchhaltung',       label: 'Buchhaltung',       icon: BookOpen,        key: 'buchhaltung' },
  { href: '/emails',            label: 'E-Mails',           icon: Mail,            key: 'emails' },
  { href: '/verlauf',           label: 'Verlauf',           icon: History,         key: 'verlauf' },
  { href: '/statistiken',       label: 'Statistiken',       icon: BarChart2,       key: 'statistiken' },
  { href: '/benachrichtigungen',label: 'Benachrichtigungen',icon: Bell,            key: 'benachrichtigungen' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { kannZugreifen, loading } = useRollen()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sichtbareItems = loading ? [] : navItems.filter(i => kannZugreifen(i.key))

  return (
    <aside className="flex flex-col h-full w-64 bg-gray-900 text-white">
      <div className="flex items-center justify-center px-6 py-4 border-b border-gray-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-v.avif"
          alt="Helios Automobile"
          width={160}
          height={56}
          className="object-contain"
        />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {sichtbareItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors group min-h-[48px]',
                active
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-600 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-4 h-4" />}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-700 space-y-0.5">
        {kannZugreifen('einstellungen') && (
          <Link
            href="/einstellungen"
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span>Einstellungen</span>
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-900/50 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Abmelden</span>
        </button>
      </div>
    </aside>
  )
}
