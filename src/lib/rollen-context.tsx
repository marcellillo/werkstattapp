'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Rolle = 'admin' | 'mechaniker' | 'buchhalter'

export const DEFAULT_BERECHTIGUNGEN: Record<Rolle, string[]> = {
  admin: [
    'dashboard', 'hebebuehnen', 'fahrzeuge', 'termine', 'kunden', 'teile',
    'kalender', 'tuev_wecker', 'service_wecker', 'rechnungen', 'emails', 'verlauf', 'statistiken',
    'benachrichtigungen', 'einstellungen', 'buchhaltung', 'admin',
  ],
  mechaniker: [
    'dashboard', 'hebebuehnen', 'fahrzeuge', 'termine', 'teile', 'tuev_wecker', 'service_wecker', 'benachrichtigungen',
  ],
  buchhalter: [
    'dashboard', 'buchhaltung', 'rechnungen', 'statistiken', 'benachrichtigungen',
  ],
}

interface RollenContextValue {
  rolle: Rolle
  berechtigungen: string[]
  kannZugreifen: (key: string) => boolean
  loading: boolean
}

const RollenContext = createContext<RollenContextValue>({
  rolle: 'mechaniker',
  berechtigungen: DEFAULT_BERECHTIGUNGEN.mechaniker,
  kannZugreifen: () => false,
  loading: true,
})

export function RollenProvider({ children }: { children: React.ReactNode }) {
  const [rolle, setRolle] = useState<Rolle>('admin')
  const [berechtigungen, setBerechtigungen] = useState<string[]>(DEFAULT_BERECHTIGUNGEN.admin)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  // TODO: Implement proper role loading from DB
  // For now, using admin role as default for debugging

  return (
    <RollenContext.Provider value={{
      rolle,
      berechtigungen,
      kannZugreifen: (key) => berechtigungen.includes(key),
      loading,
    }}>
      {children}
    </RollenContext.Provider>
  )
}

export const useRollen = () => useContext(RollenContext)
