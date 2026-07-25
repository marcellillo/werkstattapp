'use client'
import { useState, useEffect } from 'react'
import { useBetrieb } from '@/lib/betrieb-context'
import { FEATURE_CATALOG, FeatureName } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/client'
import { AppLayout } from '@/components/layout/app-layout'

export default function BetriebFeaturesPage() {
  const { currentBetriebId, currentBetrieb, isFeatureEnabled } = useBetrieb()
  const supabase = createClient()
  const [features, setFeatures] = useState<Record<FeatureName, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (currentBetriebId) {
      loadFeatures()
    }
  }, [currentBetriebId])

  async function loadFeatures() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('betrieb_einstellungen')
        .select('schluessel, wert')
        .eq('betrieb_id', currentBetriebId)
        .filter('schluessel', 'ilike', 'feature_enabled_%')

      const featureStates: Record<FeatureName, boolean> = {}
      for (const [name] of Object.entries(FEATURE_CATALOG)) {
        const setting = data?.find(s => s.schluessel === `feature_enabled_${name}`)
        featureStates[name as FeatureName] = setting?.wert === 'true'
      }
      setFeatures(featureStates)
    } catch (error) {
      console.error('Error loading features:', error)
      setMessage({ type: 'error', text: 'Fehler beim Laden der Features' })
    } finally {
      setLoading(false)
    }
  }

  async function toggleFeature(featureName: FeatureName) {
    setSaving(true)
    try {
      const newValue = !features[featureName]
      const { error } = await supabase.from('betrieb_einstellungen').upsert({
        betrieb_id: currentBetriebId,
        schluessel: `feature_enabled_${featureName}`,
        wert: newValue ? 'true' : 'false',
      })

      if (error) throw error

      setFeatures(prev => ({ ...prev, [featureName]: newValue }))
      setMessage({ type: 'success', text: 'Feature aktualisiert!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error saving feature:', error)
      setMessage({ type: 'error', text: 'Fehler beim Speichern' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout title="Feature-Verwaltung">
      <div className="max-w-4xl">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Features für {currentBetrieb?.name}</h2>
          <p className="text-sm text-slate-600">Wählen Sie, welche Features Ihr Betrieb nutzen möchte</p>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="text-slate-600">Lade Features...</div>
        ) : (
          <div className="grid gap-4">
            {Object.entries(FEATURE_CATALOG).map(([name, feature]) => (
              <div
                key={name}
                className="p-4 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{feature.icon}</span>
                      <h3 className="font-semibold text-slate-900">{feature.label}</h3>
                      {feature.category === 'optional' && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Optional</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{feature.description}</p>
                  </div>

                  <button
                    onClick={() => toggleFeature(name as FeatureName)}
                    disabled={saving}
                    className={`ml-4 px-4 py-2 rounded-lg font-medium transition-colors ${
                      features[name as FeatureName]
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {features[name as FeatureName] ? '✓ Aktiviert' : 'Deaktiviert'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            💡 <strong>Hinweis:</strong> Die Navigation wird automatisch angepasst, wenn Sie Features aktivieren oder deaktivieren.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
