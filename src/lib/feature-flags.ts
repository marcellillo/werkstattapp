// Feature-Flags für betrieb-spezifische Masken/Features
// Speichert in betrieb_einstellungen mit Schlüssel: "feature_enabled_{name}"

export type FeatureName =
  | 'rechnungssystem'
  | 'teile_bestellen'
  | 'kalender'
  | 'statistiken'
  | 'email_sync'
  | 'ki_teile'

export interface Feature {
  name: FeatureName
  label: string
  description: string
  icon: string
  category: 'core' | 'optional'
}

// Feature-Katalog
export const FEATURE_CATALOG: Record<FeatureName, Feature> = {
  rechnungssystem: {
    name: 'rechnungssystem',
    label: 'Rechnungssystem',
    description: 'Fahrzeug-Rechnungen generieren und verwalten',
    icon: '📋',
    category: 'optional',
  },
  teile_bestellen: {
    name: 'teile_bestellen',
    label: 'Ersatzteile-Verwaltung',
    description: 'Ersatzteile bestellen, tracken und verwalten',
    icon: '🔧',
    category: 'optional',
  },
  kalender: {
    name: 'kalender',
    label: 'Kalender & Termine',
    description: 'Termine und Kalenderansicht',
    icon: '📅',
    category: 'optional',
  },
  statistiken: {
    name: 'statistiken',
    label: 'Statistiken & Reports',
    description: 'Auswertungen und Berichte',
    icon: '📊',
    category: 'optional',
  },
  email_sync: {
    name: 'email_sync',
    label: 'Email-Sync',
    description: 'Email-Integration und automatisches Parsing',
    icon: '📧',
    category: 'optional',
  },
  ki_teile: {
    name: 'ki_teile',
    label: 'KI Teilevorschlag',
    description: 'KI-basierte Teilesuche und Vorschläge',
    icon: '🤖',
    category: 'optional',
  },
}

// Server-side: Check ob Feature aktiviert ist
export async function isFeatureEnabled(
  betriebId: string | null,
  featureName: FeatureName,
  supabase: any
): Promise<boolean> {
  if (!betriebId) return false

  const { data } = await supabase
    .from('betrieb_einstellungen')
    .select('wert')
    .eq('betrieb_id', betriebId)
    .eq('schluessel', `feature_enabled_${featureName}`)
    .single()

  return data?.wert === 'true'
}

// Server-side: Get all features für einen Betrieb
export async function getBetriebFeatures(
  betriebId: string | null,
  supabase: any
): Promise<Record<FeatureName, boolean>> {
  if (!betriebId) return getDefaultFeatures()

  const { data: settings } = await supabase
    .from('betrieb_einstellungen')
    .select('schluessel, wert')
    .eq('betrieb_id', betriebId)
    .filter('schluessel', 'ilike', 'feature_enabled_%')

  const features: Record<FeatureName, boolean> = getDefaultFeatures()

  for (const setting of settings ?? []) {
    const featureName = setting.schluessel.replace('feature_enabled_', '')
    if (featureName in features) {
      features[featureName as FeatureName] = setting.wert === 'true'
    }
  }

  return features
}

// Default features (wenn keine Konfiguration existiert)
function getDefaultFeatures(): Record<FeatureName, boolean> {
  return {
    rechnungssystem: true,
    teile_bestellen: true,
    kalender: true,
    statistiken: true,
    email_sync: false,
    ki_teile: false,
  }
}

// Client-side: Hook für Feature-Check
export function useFeatureEnabled(featureName: FeatureName): boolean {
  // Wird in useBetrieb() Hook kombiniert
  // Placeholder - wird später mit BetriebContext verbunden
  return true
}
