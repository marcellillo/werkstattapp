'use client'
import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { BottomNav } from './bottom-nav'
import { RollenProvider } from '@/lib/rollen-context'
import { PageTransition } from '@/components/ui/page-transition'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
  title: string
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <RollenProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 lg:z-auto transition-transform duration-300 hidden lg:block',
          sidebarOpen ? 'translate-x-0 !block' : '-translate-x-full lg:translate-x-0'
        )}>
          <Sidebar />
        </div>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar title={title} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-5 md:p-6 main-content-pb lg:pb-6">
            <PageTransition>
              {children}
            </PageTransition>
          </main>
        </div>

        <BottomNav />
      </div>
    </RollenProvider>
  )
}
