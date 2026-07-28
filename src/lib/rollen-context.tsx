'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Rolle = 'admin' | 'mechaniker' | 'buchhalter' | 'superadmin'

interface Betrieb {
  id: string
  name: string
}

export const DEFAULT_BERECHTIGUNGEN: Record<Rolle, string[]> = {
  superadmin: [
    'dashboard', 'hebebuehnen', 'fahrzeuge', 'termine', 'kunden', 'teile',
    'kalender', 'tuev_wecker', 'service_wecker', 'rechnungen', 'emails', 'verlauf', 'statistiken',
    'benachrichtigungen', 'einstellungen', 'buchhaltung', 'admin', 'superadmin',
  ],
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
  role: Rolle
  berechtigungen: string[]
  kannZugreifen: (key: string) => boolean
  loading: boolean
  isSuperAdmin: boolean
  betriebe: Betrieb[]
  currentBetrieb: Betrieb | null
  wechselBetrieb: (betriebId: string) => void
}

const RollenContext = createContext<RollenContextValue>({
  role: 'mechaniker',
  berechtigungen: DEFAULT_BERECHTIGUNGEN.mechaniker,
  kannZugreifen: () => false,
  loading: true,
  isSuperAdmin: false,
  betriebe: [],
  currentBetrieb: null,
  wechselBetrieb: () => {},
})

export function RollenProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Rolle>('mechaniker')
  const [berechtigungen, setBerechtigungen] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [betriebe, setBetriebe] = useState<Betrieb[]>([])
  const [currentBetrieb, setCurrentBetrieb] = useState<Betrieb | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function laden() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setRole('mechaniker')
          setBerechtigungen(DEFAULT_BERECHTIGUNGEN.mechaniker)
          setLoading(false)
          return
        }

        // Check if user is superadmin (any betrieb)
        const { data: allBetriebUsers } = await supabase
          .from('betrieb_users')
          .select('role')
          .eq('profile_id', user.id)

        const userRoles = allBetriebUsers?.map(b => b.role) || []
        const isSuperAdminUser = userRoles.includes('superadmin')

        if (isSuperAdminUser) {
          // Super-Admin: load all betriebe
          setRole('superadmin')
          setBerechtigungen(DEFAULT_BERECHTIGUNGEN.superadmin)
          setIsSuperAdmin(true)

          const { data: allBetriebe } = await supabase
            .from('betriebe')
            .select('id, name')
            .order('name')

          setBetriebe(allBetriebe || [])
          setCurrentBetrieb(allBetriebe?.[0] || null)
        } else {
          // Regular user: load primary betrieb
          const { data: betriebUser } = await supabase
            .from('betrieb_users')
            .select('role, betrieb_id')
            .eq('profile_id', user.id)
            .order('is_primary', { ascending: false })
            .limit(1)
            .single()

          const userRole: Rolle = (betriebUser?.role as Rolle) ?? 'mechaniker'
          setRole(userRole)
          setBerechtigungen(DEFAULT_BERECHTIGUNGEN[userRole] ?? DEFAULT_BERECHTIGUNGEN.mechaniker)
          setIsSuperAdmin(false)

          // Load current betrieb
          if (betriebUser?.betrieb_id) {
            const { data: betrieb } = await supabase
              .from('betriebe')
              .select('id, name')
              .eq('id', betriebUser.betrieb_id)
              .single()

            setCurrentBetrieb(betrieb)
            setBetriebe(betrieb ? [betrieb] : [])
          }
        }
      } catch (error) {
        console.error('Error loading role:', error)
        setRole('mechaniker')
        setBerechtigungen(DEFAULT_BERECHTIGUNGEN.mechaniker)
      } finally {
        setLoading(false)
      }
    }

    laden()
  }, [])

  const wechselBetrieb = (betriebId: string) => {
    const betrieb = betriebe.find(b => b.id === betriebId)
    if (betrieb) {
      setCurrentBetrieb(betrieb)
    }
  }

  return (
    <RollenContext.Provider value={{
      role,
      berechtigungen,
      kannZugreifen: (key) => berechtigungen.includes(key),
      loading,
      isSuperAdmin,
      betriebe,
      currentBetrieb,
      wechselBetrieb,
    }}>
      {children}
    </RollenContext.Provider>
  )
}

export const useRollen = () => useContext(RollenContext)
