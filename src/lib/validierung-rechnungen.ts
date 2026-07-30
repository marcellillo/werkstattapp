/**
 * Validierungslogik für Rechnungen, Kostenvoranschläge, Werkstattaufträge
 */

export interface RechnungsPosition {
  beschreibung: string
  menge: number
  preis: number // Endpreis pro Stück!
  summe: number
}

export interface RechnungsDaten {
  positionen: RechnungsPosition[]
  summeNetto: number
  mehrwertsteuer: number
  summeBrutto: number
}

/**
 * Validiert eine Rechnung/Kostenvoranschlag auf Korrektheit
 */
export function validiereRechnung(daten: RechnungsDaten): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Überprüfe Positionen
  if (!daten.positionen || daten.positionen.length === 0) {
    errors.push('Keine Positionen vorhanden')
  }

  let berechneteNetto = 0

  daten.positionen?.forEach((pos, idx) => {
    if (!pos.beschreibung?.trim()) {
      errors.push(`Position ${idx + 1}: Beschreibung fehlt`)
    }

    if (pos.menge <= 0) {
      errors.push(`Position ${idx + 1}: Menge muss > 0 sein`)
    }

    if (pos.preis < 0) {
      errors.push(`Position ${idx + 1}: Preis darf nicht negativ sein`)
    }

    // Überprüfe Berechnung
    const erwarteteSumme = pos.menge * pos.preis
    if (Math.abs(pos.summe - erwarteteSumme) > 0.01) {
      errors.push(
        `Position ${idx + 1}: Summe falsch. Erwartet: ${erwarteteSumme.toFixed(2)}€, Erhalten: ${pos.summe.toFixed(2)}€`
      )
    }

    berechneteNetto += pos.summe
  })

  // Überprüfe Netto-Summe
  if (Math.abs(daten.summeNetto - berechneteNetto) > 0.01) {
    errors.push(
      `Netto-Summe falsch. Berechnet: ${berechneteNetto.toFixed(2)}€, Erhalten: ${daten.summeNetto.toFixed(2)}€`
    )
  }

  // Überprüfe MwSt (19% Standard)
  const erwarteteMwSt = daten.summeNetto * 0.19
  if (Math.abs(daten.mehrwertsteuer - erwarteteMwSt) > 0.01) {
    warnings.push(
      `MwSt abweichend. Standard: ${erwarteteMwSt.toFixed(2)}€, Erhalten: ${daten.mehrwertsteuer.toFixed(2)}€`
    )
  }

  // Überprüfe Brutto-Summe
  const erwartetesBrutto = daten.summeNetto + daten.mehrwertsteuer
  if (Math.abs(daten.summeBrutto - erwartetesBrutto) > 0.01) {
    errors.push(
      `Brutto-Summe falsch. Berechnet: ${erwartetesBrutto.toFixed(2)}€, Erhalten: ${daten.summeBrutto.toFixed(2)}€`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Berechnet automatisch Summen basierend auf Positionen
 */
export function berechneSummen(positionen: RechnungsPosition[]): {
  summeNetto: number
  mehrwertsteuer: number
  summeBrutto: number
} {
  const summeNetto = positionen.reduce((sum, pos) => sum + pos.summe, 0)
  const mehrwertsteuer = summeNetto * 0.19
  const summeBrutto = summeNetto + mehrwertsteuer

  return {
    summeNetto: Math.round(summeNetto * 100) / 100,
    mehrwertsteuer: Math.round(mehrwertsteuer * 100) / 100,
    summeBrutto: Math.round(summeBrutto * 100) / 100,
  }
}
