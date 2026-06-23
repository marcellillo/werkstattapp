'use client'
import { Search, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { NotificationBell } from './notification-bell'

interface TopbarProps {
  title: string
  onMenuClick?: () => void
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  return (
    <header className="flex items-center gap-4 px-6 py-4 bg-white border-b border-gray-200 h-16">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="font-semibold text-gray-900 text-lg">{title}</h1>

      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <Input placeholder="Suchen..." className="pl-9 h-8 bg-gray-50 border-gray-200" />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />

        <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
          W
        </div>
      </div>
    </header>
  )
}

