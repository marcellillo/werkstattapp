'use client'
import { createContext, useContext, ReactNode, useState, useEffect } from 'react'
import { createClient } from './supabase/client'
import type { Betrieb, BetriebUser } from '@/types/database'
import type { FeatureName } from './feature-flags'
import { FEATURE_CATALOG, getBetriebFeatures } from './feature-flags'

interface BetriebContextType {
  currentBetriebId: string | null
  currentBetrieb: Betrieb | null
  availableBetriebe: Betrieb[]
  userBetriebe: BetriebUser[]
  switchBetrieb: (betriebId: string) => Promise<void>
  isLoading: boolean
  features: Record<FeatureName, boolean>
  isFeatureEnabled: (featureName: FeatureName) => boolean
}

const BetriebContext = createContext<BetriebContextType | undefined>(undefined)

export function BetriebProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [currentBetriebId, setCurrentBetriebId] = useState<string | null>(null)
  const [currentBetrieb, setCurrentBetrieb] = useState<Betrieb | null>(null)
  const [availableBetriebe, setAvailableBetriebe] = useState<Betrieb[]>([])
  const [userBetriebe, setUserBetriebe] = useState<BetriebUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [features, setFeatures] = useState<Record<FeatureName, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const name of Object.keys(FEATURE_CATALOG)) {
      initial[name] = false
    }
    return initial as Record<FeatureName, boolean>
  })

  useEffect(() => {
    loadBetriebe()
  }, [])

  async function loadBetriebe() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }

      const { data: userBetriebData, error } = await supabase
        .from('betrieb_users')
        .select('*, betriebe(*)')
        .eq('profile_id', user.id)

      if (error || !userBetriebData?.length) {
        setIsLoading(false)
        return
      }

      setUserBetriebe(userBetriebData)
      const betriebe = userBetriebData.map((ub: any) => ub.betriebe as Betrieb).filter(Boolean)
      setAvailableBetriebe(betriebe)

      const primaryBetrieb = userBetriebData.find((ub: any) => ub.is_primary)
      const betriebId = primaryBetrieb?.betrieb_id || betriebe[0]?.id

      setCurrentBetriebId(betriebId)
      if (betriebId) {
        setCurrentBetrieb(betriebe.find(b => b.id === betriebId) || null)
        // Load features for this betrieb
        const betriebFeatures = await getBetriebFeatures(betriebId, supabase)
        setFeatures(betriebFeatures)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function switchBetrieb(betriebId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const betrieb = availableBetriebe.find(b => b.id === betriebId)
    if (!betrieb) return

    await supabase
      .from('betrieb_users')
      .update({ is_primary: false })
      .eq('profile_id', user.id)

    await supabase
      .from('betrieb_users')
      .update({ is_primary: true })
      .eq('profile_id', user.id)
      .eq('betrieb_id', betriebId)

    setCurrentBetriebId(betriebId)
    setCurrentBetrieb(betrieb)

    // Load features for new betrieb
    const betriebFeatures = await getBetriebFeatures(betriebId, supabase)
    setFeatures(betriebFeatures)
  }

  return (
    <BetriebContext.Provider
      value={{
        currentBetriebId,
        currentBetrieb,
        availableBetriebe,
        userBetriebe,
        switchBetrieb,
        isLoading,
        features,
        isFeatureEnabled: (featureName: FeatureName) => features[featureName] ?? false,
      }}
    >
      {children}
    </BetriebContext.Provider>
  )
}

export function useBetrieb() {
  const context = useContext(BetriebContext)
  if (!context) {
    throw new Error('useBetrieb muss innerhalb BetriebProvider verwendet werden')
  }
  return context
}
