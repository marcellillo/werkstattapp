import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Generiert eine Nummer basierend auf FIN (letzte 6 Ziffern)
 * Format: KV-240001 (KV = Kostenvoranschlag, 24 = Jahr, 0001 = laufende Nummer)
 */
export async function generateKostenvoranschlagNummer(
  supabase: SupabaseClient,
  fahrzeugId: string,
  betriebId: string
): Promise<string> {
  // Hole Fahrzeug-FIN
  const { data: fahrzeug } = await supabase
    .from('fahrzeuge')
    .select('fin')
    .eq('id', fahrzeugId)
    .single()

  if (!fahrzeug?.fin) throw new Error('Fahrzeug-FIN nicht gefunden')

  // Letzte 6 Ziffern der FIN
  const finTail = fahrzeug.fin.slice(-6).toUpperCase()

  // Laufende Nummer dieses Jahr für Kostenvoranschläge
  const year = new Date().getFullYear().toString().slice(-2)

  const { data: lastKv } = await supabase
    .from('kostenvoranschlaege')
    .select('nummer')
    .eq('betrieb_id', betriebId)
    .ilike('nummer', `KV-${year}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextNum = 1
  if (lastKv?.nummer) {
    const match = lastKv.nummer.match(/(\d{4})$/)
    if (match) nextNum = parseInt(match[1]) + 1
  }

  return `KV-${finTail}-${year}${String(nextNum).padStart(4, '0')}`
}

/**
 * Generiert Werkstattauftrag-Nummer
 */
export async function generateWerkstattauftragNummer(
  supabase: SupabaseClient,
  fahrzeugId: string,
  betriebId: string
): Promise<string> {
  const { data: fahrzeug } = await supabase
    .from('fahrzeuge')
    .select('fin')
    .eq('id', fahrzeugId)
    .single()

  if (!fahrzeug?.fin) throw new Error('Fahrzeug-FIN nicht gefunden')

  const finTail = fahrzeug.fin.slice(-6).toUpperCase()
  const year = new Date().getFullYear().toString().slice(-2)

  const { data: lastWa } = await supabase
    .from('werkstattauftraege')
    .select('id')
    .eq('betrieb_id', betriebId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextNum = 1
  if (lastWa?.id) {
    // Zähle alle Werkstattaufträge dieses Jahr
    const { count } = await supabase
      .from('werkstattauftraege')
      .select('*', { count: 'exact', head: true })
      .eq('betrieb_id', betriebId)

    nextNum = (count || 0) + 1
  }

  return `WA-${finTail}-${year}${String(nextNum).padStart(4, '0')}`
}

/**
 * Generiert Rechnungs-Nummer
 */
export async function generateRechnungsNummer(
  supabase: SupabaseClient,
  typ: 'werkstatt' | 'verkauf',
  betriebId: string
): Promise<string> {
  const prefix = typ === 'werkstatt' ? 'RW' : 'RV'
  const year = new Date().getFullYear().toString().slice(-2)

  const { data: lastRechnung } = await supabase
    .from('rechnungen')
    .select('nummer')
    .eq('betrieb_id', betriebId)
    .eq('typ', typ)
    .ilike('nummer', `${prefix}-${year}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextNum = 1
  if (lastRechnung?.nummer) {
    const match = lastRechnung.nummer.match(/(\d{4})$/)
    if (match) nextNum = parseInt(match[1]) + 1
  }

  return `${prefix}-${year}${String(nextNum).padStart(4, '0')}`
}

/**
 * Generiert Vorvertrag-Nummer (Verkauf)
 */
export async function generateVorvertragNummer(
  supabase: SupabaseClient,
  fahrzeugId: string,
  betriebId: string
): Promise<string> {
  const { data: fahrzeug } = await supabase
    .from('fahrzeuge')
    .select('fin')
    .eq('id', fahrzeugId)
    .single()

  if (!fahrzeug?.fin) throw new Error('Fahrzeug-FIN nicht gefunden')

  const finTail = fahrzeug.fin.slice(-6).toUpperCase()
  const year = new Date().getFullYear().toString().slice(-2)

  const { data: lastVv } = await supabase
    .from('vorvertraege')
    .select('nummer')
    .eq('betrieb_id', betriebId)
    .ilike('nummer', `VV-${finTail}-${year}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextNum = 1
  if (lastVv?.nummer) {
    const match = lastVv.nummer.match(/(\d{4})$/)
    if (match) nextNum = parseInt(match[1]) + 1
  }

  return `VV-${finTail}-${year}${String(nextNum).padStart(4, '0')}`
}
