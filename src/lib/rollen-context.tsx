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
  const [rolle, setRolle] = useState<Rolle>('mechaniker')
  const [berechtigungen, setBerechtigungen] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function laden() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setRolle('mechaniker')
          setBerechtigungen(DEFAULT_BERECHTIGUNGEN.mechaniker)
          setLoading(false)
          return
        }

        // Get user's primary betrieb and rolle
        const { data: betriebUser } = await supabase
          .from('betrieb_users')
          .select('rolle')
          .eq('profile_id', user.id)
          .order('is_primary', { ascending: false })
          .limit(1)
          .single()

        const userRolle: Rolle = (betriebUser?.rolle as Rolle) ?? 'mechaniker'
        setRolle(userRolle)
        setBerechtigungen(DEFAULT_BERECHTIGUNGEN[userRolle] ?? DEFAULT_BERECHTIGUNGEN.mechaniker)
      } catch (error) {
        console.error('Error loading role:', error)
        setRolle('mechaniker')
        setBerechtigungen(DEFAULT_BERECHTIGUNGEN.mechaniker)
      } finally {
        setLoading(false)
      }
    }

    laden()
  }, [])

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
