// Steuerliche Behandlung von Fahrzeugverkäufen (Eigenfahrzeuge)

export type Steuerart = 'differenz' | 'regel' | 'ausfuhr'

export const STEUERART_LABEL: Record<Steuerart, string> = {
  differenz: 'Differenzbesteuerung §25a',
  regel: 'Regelbesteuerung 19%',
  ausfuhr: 'Ausfuhr (steuerfrei)',
}

export const STEUERART_KURZ: Record<Steuerart, string> = {
  differenz: '§25a',
  regel: '19%',
  ausfuhr: 'Ausfuhr',
}

export const STEUERART_COLOR: Record<Steuerart, string> = {
  differenz: 'bg-blue-100 text-blue-700 border-blue-200',
  regel: 'bg-amber-100 text-amber-700 border-amber-200',
  ausfuhr: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const MWST_SATZ = 0.19

export interface SteuerErgebnis {
  vk: number          // Verkaufspreis (brutto)
  ek: number          // Einkaufspreis
  art: Steuerart
  marge: number       // Rohmarge VK - EK
  mwst: number        // abzuführende Umsatzsteuer
  netto: number       // Nettoerlös (VK - MwSt)
  gewinn: number      // VK - EK - Aufbereitung(Teile) - MwSt
}

/**
 * Berechnet MwSt, Marge und Gewinn eines Fahrzeugverkaufs.
 * - differenz: MwSt = (VK-EK) * 19/119, nie negativ
 * - regel:     MwSt = VK * 19/119
 * - ausfuhr:   steuerfrei (MwSt = 0)
 */
export function berechneFahrzeugSteuer(opts: {
  verkaufspreis?: number | null
  einkaufspreis?: number | null
  steuerart?: Steuerart | null
  teileKosten?: number | null
}): SteuerErgebnis {
  const vk = opts.verkaufspreis ?? 0
  const ek = opts.einkaufspreis ?? 0
  const art: Steuerart = opts.steuerart ?? 'differenz'
  const teile = opts.teileKosten ?? 0

  let mwst = 0
  if (art === 'regel') mwst = vk * MWST_SATZ / (1 + MWST_SATZ)
  else if (art === 'differenz') mwst = Math.max(0, vk - ek) * MWST_SATZ / (1 + MWST_SATZ)
  // ausfuhr: steuerfrei → mwst bleibt 0

  const marge = vk - ek
  const netto = vk - mwst
  const gewinn = vk - ek - teile - mwst

  return { vk, ek, art, marge, mwst, netto, gewinn }
}
