import { createClient } from '@/lib/supabase/server'

export interface ScannedPart {
  beschreibung: string
  menge: number
  preis?: number
  teilenummer?: string
  lieferant?: string
}

export interface ValidatedPart extends ScannedPart {
  isValid: boolean
  matchedId?: string
  confidence: number
}

export async function validateAndInsertParts(
  auftragId: string,
  betriebId: string,
  parts: ScannedPart[],
  werkstattauftragId?: string
): Promise<{ validated: ValidatedPart[], inserted: number }> {
  const supabase = await createClient()

  // Lade bestehende Teile aus Katalog
  const { data: katalog } = await supabase
    .from('ersatzteile')
    .select('id, bezeichnung, teilenummer, lieferant, einzelpreis')
    .eq('betrieb_id', betriebId)

  const validated: ValidatedPart[] = []
  let inserted = 0

  for (const part of parts) {
    // Versuche zu matchen
    let match: any = null
    let confidence = 0

    if (katalog) {
      // Match by Teilnummer
      if (part.teilenummer) {
        match = katalog.find(
          (k) => k.teilenummer?.toLowerCase() === part.teilenummer?.toLowerCase()
        )
        if (match) confidence = 1.0
      }

      // Match by Beschreibung (Fuzzy)
      if (!match) {
        const descLower = part.beschreibung.toLowerCase()
        match = katalog.find(
          (k) =>
            k.bezeichnung?.toLowerCase().includes(descLower) ||
            descLower.includes(k.bezeichnung?.toLowerCase() || '')
        )
        if (match) confidence = 0.8
      }
    }

    const validatedPart: ValidatedPart = {
      ...part,
      isValid: !!match,
      matchedId: match?.id,
      confidence,
    }

    validated.push(validatedPart)

    // Füge in ersatzteile ein
    if (validatedPart.isValid) {
      try {
        const { error } = await supabase.from('ersatzteile').insert({
          auftrag_id: auftragId,
          betrieb_id: betriebId,
          bezeichnung: part.beschreibung,
          teilenummer: part.teilenummer || null,
          lieferant: part.lieferant || null,
          menge: part.menge,
          einzelpreis: part.preis || null,
          status: 'bestellt',
        })

        if (!error) inserted++
      } catch (e) {
        console.warn('[Teile Insert] Fehler:', e)
      }
    }

    // Füge auch in werkstattauftrag_positionen ein wenn vorhanden
    if (werkstattauftragId) {
      try {
        const einzelpreis = part.preis || 0
        const gesamtpreis = (part.menge || 1) * einzelpreis
        await supabase.from('werkstattauftrag_positionen').insert({
          werkstattauftrag_id: werkstattauftragId,
          betrieb_id: betriebId,
          beschreibung: part.beschreibung,
          menge: part.menge || 1,
          einzelpreis,
          gesamtpreis,
        })
      } catch (e) {
        console.warn('[WA Insert] Fehler:', e)
      }
    }
  }

  return { validated, inserted }
}

export async function matchTeilAgainstKatalog(
  betriebId: string,
  description: string,
  teilenummer?: string
): Promise<{ match: any | null, confidence: number }> {
  const supabase = await createClient()

  const { data: katalog } = await supabase
    .from('ersatzteile')
    .select('id, bezeichnung, teilenummer, lieferant, einzelpreis')
    .eq('betrieb_id', betriebId)

  if (!katalog) return { match: null, confidence: 0 }

  // Match by Teilnummer first
  if (teilenummer) {
    const match = katalog.find(
      (k) => k.teilenummer?.toLowerCase() === teilenummer.toLowerCase()
    )
    if (match) return { match, confidence: 1.0 }
  }

  // Match by Beschreibung
  const descLower = description.toLowerCase()
  const match = katalog.find(
    (k) =>
      k.bezeichnung?.toLowerCase().includes(descLower) ||
      descLower.includes(k.bezeichnung?.toLowerCase() || '')
  )

  return {
    match: match || null,
    confidence: match ? 0.8 : 0,
  }
}
