'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { RollenProvider } from '@/lib/rollen-context'
import { BetriebProvider } from '@/lib/betrieb-context'
import { PageTitleProvider, usePageTitleContext } from '@/lib/page-title-context'
import { PageTransition } from '@/components/ui/page-transition'
import { cn } from '@/lib/utils'

// Statischer Pfad->Titel. Seiten mit dynamischem Titel (z.B. Fahrzeug-Detail)
// setzen ihren Titel selbst über <SetTitle value="..."/>, das überschreibt
// diese Tabelle für die Dauer, in der die Seite gemountet ist.
const PAGE_TITLES: Record<string, string> = {
  '/': 'Sales Dashboard',
  '/dashboard': 'Dashboard',
  '/fahrzeuge': 'Fahrzeuge',
  '/fahrzeuge/neu': 'Neues Fahrzeug',
  '/fahrzeuge/verkauft': 'Verkaufte Fahrzeuge',
  '/fahrzeuge/uebergeben': 'Übergebene Fahrzeuge',
  '/hebebuehnen': 'Hebebühnen verwalten',
  '/teile': 'Lager',
  '/kalender': 'Kalender',
  '/termine': 'Termine',
  '/kunden': 'Kunden',
  '/einstellungen': 'Einstellungen',
  '/statistiken': 'Statistiken',
  '/rechnungen': 'Rechnungen',
  '/benachrichtigungen': 'Benachrichtigungen',
  '/annahme': 'Annahme',
  '/buchhaltung': 'Buchhaltung',
  '/werkstattauftraege': 'Werkstattaufträge',
  '/verlauf': 'Verlauf',
  '/mitarbeiter': 'Mitarbeiter',
  '/tuev-wecker': 'TÜV-Wecker',
  '/kostenvoranschlaege': 'Kostenvoranschläge',
  '/emails': 'E-Mail-Protokoll',
  '/service-wecker': 'Service-Wecker',
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { title: overrideTitle } = usePageTitleContext()
  const title = overrideTitle ?? PAGE_TITLES[pathname] ?? (pathname.startsWith('/fahrzeuge/') ? 'Fahrzeuge' : 'Werkstatt Manager')

  return (
    <div className="flex bg-slate-50 min-h-screen">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={cn(
        'fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-50 lg:z-auto transition-transform duration-300 hidden lg:block lg:flex-shrink-0',
        sidebarOpen ? 'translate-x-0 !block' : '-translate-x-full lg:translate-x-0'
      )}>
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="sticky top-0 z-20">
          <Topbar title={title} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        </div>
        <main className="flex-1 p-5 md:p-6 main-content-pb lg:pb-10">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <BetriebProvider>
      <RollenProvider>
        <PageTitleProvider>
          <AppShell>{children}</AppShell>
        </PageTitleProvider>
      </RollenProvider>
    </BetriebProvider>
  )
}
