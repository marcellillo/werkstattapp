'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRollen } from '@/lib/rollen-context'
import { useBetrieb } from '@/lib/betrieb-context'
import { useBenachrichtigungenAnzahl } from '@/hooks/use-benachrichtigungen-anzahl'
import { NAV_HAUPT, NAV_MEHR, sichtbar, type NavItem } from '@/lib/nav-config'

// Untere Leiste auf dem Handy: die ersten drei erlaubten Haupt-Punkte (Heute, Aufträge, Eigenfahrzeuge)
// + "Mehr" mit allem Übrigen (restliche Haupt-Punkte, dann die weiteren Funktionen).
export function BottomNav() {
  const pathname = usePathname()
  const tab = useSearchParams().get('tab')
  const router = useRouter()
  const supabase = createClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { kannZugreifen, loading } = useRollen()
  const { isFeatureEnabled } = useBetrieb()
  const benAnzahl = useBenachrichtigungenAnzahl()

  const sichtbarFn = (i: NavItem) => !loading && sichtbar(i, kannZugreifen, isFeatureEnabled)
  const alleHaupt = NAV_HAUPT.filter(sichtbarFn)
  const mainItems = alleHaupt.slice(0, 3)
  const drawerGruppen = [
    { label: 'Tagesgeschäft', items: alleHaupt.slice(3) },
    ...NAV_MEHR.map(g => ({ ...g, items: g.items.filter(sichtbarFn) })),
  ].filter(g => g.items.length > 0)
  const isMoreActive = drawerGruppen.flatMap(g => g.items).some(i => i.aktiv(pathname, tab))

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setDrawerOpen(false)} />
      )}

      {drawerOpen && (
        <div className="fixed bottom-16 left-0 right-0 z-50 lg:hidden bg-white rounded-t-2xl shadow-2xl border-t border-gray-100 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between px-4 pt-4 pb-2 sticky top-0 bg-white border-b border-gray-100">
            <span className="font-semibold text-gray-900">Menü</span>
            <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="p-3 space-y-4" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            {drawerGruppen.map(group => (
              <div key={group.label}>
                <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{group.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {group.items.map(({ href, label, icon: Icon, badge, aktiv }) => {
                    const active = aktiv(pathname, tab)
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
                          {badge === 'benachrichtigungen' && benAnzahl > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                              {benAnzahl > 99 ? '99+' : benAnzahl}
                            </span>
                          )}
                        </div>
                        <span className="text-center leading-tight">{label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Einstellungen + Abmelden */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
              {kannZugreifen('einstellungen') && (
                <Link
                  href="/einstellungen"
                  onClick={() => setDrawerOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-colors',
                    pathname === '/einstellungen' ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Settings className="w-6 h-6" />
                  <span>Einstellungen</span>
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-6 h-6" />
                <span>Abmelden</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch h-16">
          {mainItems.map(({ href, label, icon: Icon, aktiv }) => {
            const active = aktiv(pathname, tab)
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
