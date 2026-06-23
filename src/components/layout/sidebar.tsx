'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Car, Users, Package, Calendar,
  Bell, Settings, LogOut, Wrench, ChevronRight, BarChart2,
  Mail, CalendarClock, ShieldCheck, Layers, Receipt, History
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hebebuehnen', label: 'Hebebühnen', icon: Layers },
  { href: '/fahrzeuge', label: 'Fahrzeuge', icon: Car },
  { href: '/termine', label: 'Termine', icon: CalendarClock },
  { href: '/kunden', label: 'Kunden', icon: Users },
  { href: '/teile', label: 'Ersatzteile', icon: Package },
  { href: '/kalender', label: 'Kalender', icon: Calendar },
  { href: '/rechnungen', label: 'Rechnungen', icon: Receipt },
  { href: '/emails', label: 'E-Mails', icon: Mail },
  { href: '/verlauf', label: 'Verlauf', icon: History },
  { href: '/statistiken', label: 'Statistiken', icon: BarChart2 },
  { href: '/benachrichtigungen', label: 'Benachrichtigungen', icon: Bell },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col h-full w-64 bg-gray-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-700">
        <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm">Werkstatt</p>
          <p className="text-xs text-gray-600">Manager</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
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

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-gray-700 space-y-0.5">
        <Link
          href="/einstellungen"
          className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <Settings className="w-5 h-5" />
          <span>Einstellungen</span>
        </Link>
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

