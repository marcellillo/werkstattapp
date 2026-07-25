export type FeatureName = 'statistiken' | 'kalender' | 'teile_bestellen' | 'rechnungssystem'

export const FEATURE_CATALOG: Record<FeatureName, { name: string; description: string }> = {
  statistiken: { name: 'Statistiken', description: 'Statistische Auswertungen' },
  kalender: { name: 'Kalender', description: 'Kalender-Integration' },
  teile_bestellen: { name: 'Teile bestellen', description: 'Teile-Bestellung' },
  rechnungssystem: { name: 'Rechnungssystem', description: 'Automatische Rechnungen' },
}

export function getBetriebFeatures(betriebId: string, supabase?: any): Record<FeatureName, boolean> {
  return {
    statistiken: true,
    kalender: false,
    teile_bestellen: false,
    rechnungssystem: true,
  }
}
