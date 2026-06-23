// Prioritäts-Scoring für Aufträge
// Je höher der Score, desto dringlicher

export type Prioritaet = 'kritisch' | 'hoch' | 'mittel' | 'normal'

export interface PrioritaetInfo {
  stufe: Prioritaet
  score: number
  gruende: string[]
}

export function berechnePrioritaet(auftrag: any): PrioritaetInfo {
  const gruende: string[] = []
  let score = 0

  const heute = new Date()
  const erstelltAm = auftrag.erstellt_am ? new Date(auftrag.erstellt_am) : null
  const fertigBis = auftrag.geplante_fertigstellung ? new Date(auftrag.geplante_fertigstellung) : null
  const tuevTermin = auftrag.tuev_termin ? new Date(auftrag.tuev_termin) : null
  const aktiv = !['fertig', 'ausgeliefert'].includes(auftrag.status)
  const teile: any[] = auftrag.ersatzteile ?? []

  if (!aktiv) return { stufe: 'normal', score: 0, gruende: [] }

  // Überfällig (Fertigstellungsdatum überschritten)
  if (fertigBis && fertigBis < heute) {
    const tageUeberfaellig = Math.floor((heute.getTime() - fertigBis.getTime()) / 86_400_000)
    if (tageUeberfaellig > 3) {
      score += 5
      gruende.push(`${tageUeberfaellig} Tage überfällig`)
    } else {
      score += 3
      gruende.push('Fertigstellung überschritten')
    }
  }

  // TÜV-Kandidat mit nahem Termin
  if (auftrag.tuev_kandidat) {
    if (tuevTermin) {
      const tage = Math.floor((tuevTermin.getTime() - heute.getTime()) / 86_400_000)
      if (tage < 0) {
        score += 5
        gruende.push('TÜV-Termin überschritten')
      } else if (tage <= 3) {
        score += 4
        gruende.push(`TÜV in ${tage} Tagen`)
      } else if (tage <= 7) {
        score += 3
        gruende.push(`TÜV in ${tage} Tagen`)
      } else {
        score += 2
        gruende.push('TÜV-Kandidat')
      }
    } else {
      score += 2
      gruende.push('TÜV-Kandidat (kein Termin)')
    }
  }

  // Warten auf Teile
  if (auftrag.status === 'warten_teile') {
    score += 2
    gruende.push('Wartet auf Teile')
  }

  // Fehlende / noch nicht bestellte Teile
  const nichtBestellt = teile.filter(t => t.status === 'nicht_bestellt').length
  if (nichtBestellt > 0) {
    score += 2
    gruende.push(`${nichtBestellt} Teil${nichtBestellt > 1 ? 'e' : ''} nicht bestellt`)
  }

  // Lange in der Werkstatt (Zeitaufwand / Aufenthaltsdauer)
  if (erstelltAm) {
    const tageInWerkstatt = Math.floor((heute.getTime() - erstelltAm.getTime()) / 86_400_000)
    if (tageInWerkstatt > 14) {
      score += 3
      gruende.push(`${tageInWerkstatt} Tage in Werkstatt`)
    } else if (tageInWerkstatt > 7) {
      score += 1
      gruende.push(`${tageInWerkstatt} Tage in Werkstatt`)
    }
  }

  // Zu lange auf der Hebebühne
  if (auftrag.hebebuehne_id && erstelltAm) {
    const tage = Math.floor((heute.getTime() - erstelltAm.getTime()) / 86_400_000)
    if (tage > 3) {
      score += 2
      gruende.push(`${tage} Tage auf Hebebühne`)
    }
  }

  const stufe: Prioritaet =
    score >= 7 ? 'kritisch' :
    score >= 4 ? 'hoch' :
    score >= 2 ? 'mittel' :
    'normal'

  return { stufe, score, gruende }
}

export const PRIORITAET_LABEL: Record<Prioritaet, string> = {
  kritisch: 'Kritisch',
  hoch: 'Hoch',
  mittel: 'Mittel',
  normal: 'Normal',
}

export const PRIORITAET_COLOR: Record<Prioritaet, string> = {
  kritisch: 'bg-red-100 text-red-700 border-red-300',
  hoch: 'bg-orange-100 text-orange-700 border-orange-300',
  mittel: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  normal: 'bg-gray-100 text-gray-600 border-gray-200',
}

export const PRIORITAET_DOT: Record<Prioritaet, string> = {
  kritisch: 'bg-red-500',
  hoch: 'bg-orange-500',
  mittel: 'bg-yellow-400',
  normal: 'bg-gray-300',
}
