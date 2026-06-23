'use client'
import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function NotificationBell() {
  const [anzahl, setAnzahl] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/benachrichtigungen/anzahl')
      .then(r => r.json())
      .then(d => setAnzahl(d.anzahl ?? 0))
      .catch(() => setAnzahl(0))
  }, [])

  return (
    <Link href="/benachrichtigungen">
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="w-5 h-5" />
        {anzahl !== null && anzahl > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1">
            {anzahl > 99 ? '99+' : anzahl}
          </span>
        )}
      </Button>
    </Link>
  )
}
