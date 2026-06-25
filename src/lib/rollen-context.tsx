'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Rolle = 'admin' | 'werkstattmeister' | 'mechaniker' | 'buchhalter'

export const DEFAULT_BERECHTIGUNGEN: Record<Rolle, string[]> = {
  admin: [
    'dashboard', 'hebebuehnen', 'fahrzeuge', 'termine', 'kunden', 'teile',
    'kalender', 'tuev_wecker', 'service_wecker', 'rechnungen', 'emails', 'verlauf', 'statistiken',
    'benachrichtigungen', 'einstellungen', 'buchhaltung',
  ],
  werkstattmeister: [
    'dashboard', 'hebebuehnen', 'fahrzeuge', 'termine', 'kunden', 'teile',
    'kalender', 'tuev_wecker', 'service_wecker', 'rechnungen', 'emails', 'verlauf', 'statistiken', 'benachrichtigungen',
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [{ data: profile }, { data: config }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).single(),
        supabase.from('werkstatt_einstellungen').select('wert').eq('schluessel', 'rollen_berechtigungen').single(),
      ])

      const userRolle: Rolle = (profile?.role as Rolle) ?? 'mechaniker'
      setRolle(userRolle)

      let berechtigungenMap = DEFAULT_BERECHTIGUNGEN
      if (config?.wert) {
        try { berechtigungenMap = JSON.parse(config.wert) } catch {}
      }
      setBerechtigungen(berechtigungenMap[userRolle] ?? DEFAULT_BERECHTIGUNGEN[userRolle])
      setLoading(false)
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
