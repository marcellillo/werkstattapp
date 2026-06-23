'use client'
import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { BottomNav } from './bottom-nav'
import { RollenProvider } from '@/lib/rollen-context'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
  title: string
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <RollenProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
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
          <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 lg:pb-6">
            {children}
          </main>
        </div>

        <BottomNav />
      </div>
    </RollenProvider>
  )
}
