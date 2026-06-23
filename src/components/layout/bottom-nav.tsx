'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Car, Layers, CalendarClock, Menu, X,
  Users, Package, Calendar, Bell, BarChart2, Mail, Settings, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const mainItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hebebuehnen', label: 'Bühnen', icon: Layers },
  { href: '/fahrzeuge', label: 'Fahrzeuge', icon: Car },
  { href: '/termine', label: 'Termine', icon: CalendarClock },
]

const moreItems = [
  { href: '/kunden', label: 'Kunden', icon: Users },
  { href: '/teile', label: 'Ersatzteile', icon: Package },
  { href: '/kalender', label: 'Kalender', icon: Calendar },
  { href: '/emails', label: 'E-Mails', icon: Mail },
  { href: '/statistiken', label: 'Statistiken', icon: BarChart2 },
  { href: '/benachrichtigungen', label: 'Benachrichtigungen', icon: Bell },
  { href: '/einstellungen', label: 'Einstellungen', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isMoreActive = moreItems.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mehr-Drawer */}
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
            {moreItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
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
                  <Icon className="w-6 h-6" />
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

      {/* Bottom Bar */}
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

          {/* Mehr-Button */}
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
