import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Generiert eine Nummer basierend auf FIN (letzte 6 Ziffern)
 * Format: KV-240001 (KV = Kostenvoranschlag, 24 = Jahr, 0001 = laufende Nummer)
 */
export async function generateKostenvoranschlagNummer(
  supabase: SupabaseClient,
  fahrzeugId: string,
  betriebId: string
): Promise<string> {
  // Hole Fahrzeug-FIN (optional)
  let finTail = ''
  if (fahrzeugId) {
    const { data: fahrzeug } = await supabase
      .from('fahrzeuge')
      .select('fahrgestellnummer')
      .eq('id', fahrzeugId)
      .maybeSingle()

    if (fahrzeug?.fahrgestellnummer) {
      finTail = fahrzeug.fahrgestellnummer.slice(-6).toUpperCase() + '-'
    }
  }

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

  // Die Nummer ist in der Datenbank betriebsübergreifend eindeutig, gezählt wird aber je Betrieb:
  // hat ein anderer Betrieb die Nummer schon, wird weitergezählt (der Prüfer sieht nur "vergeben ja/nein", keine Daten).
  const admin = createAdminClient()
  for (let versuch = 0; versuch < 200; versuch++, nextNum++) {
    const nummer = `KV-${finTail}${year}${String(nextNum).padStart(4, '0')}`
    const { data: belegt } = await admin.from('kostenvoranschlaege').select('id').eq('nummer', nummer).limit(1)
    if (!belegt?.length) return nummer
  }
  throw new Error('Keine freie Kostenvoranschlag-Nummer gefunden')
}

/**
 * Generiert Werkstattauftrag-Nummer
 */
export async function generateWerkstattauftragNummer(
  supabase: SupabaseClient,
  fahrzeugId: string,
  betriebId: string
): Promise<string> {
  // Hole Fahrzeug-FIN (optional)
  let finTail = ''
  if (fahrzeugId) {
    const { data: fahrzeug } = await supabase
      .from('fahrzeuge')
      .select('fahrgestellnummer')
      .eq('id', fahrzeugId)
      .maybeSingle()

    if (fahrzeug?.fahrgestellnummer) {
      finTail = fahrzeug.fahrgestellnummer.slice(-6).toUpperCase() + '-'
    }
  }

  const year = new Date().getFullYear().toString().slice(-2)

  // Zähle alle Werkstattaufträge dieses Jahr
  const { count } = await supabase
    .from('werkstattauftraege')
    .select('*', { count: 'exact', head: true })
    .eq('betrieb_id', betriebId)

  const nextNum = (count || 0) + 1

  return `WA-${finTail}${year}${String(nextNum).padStart(4, '0')}`
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
    .from('kunden_rechnungen')
    .select('rechnungs_nr')
    .eq('betrieb_id', betriebId)
    .ilike('rechnungs_nr', `${prefix}-${year}%`)
    .order('erstellt_am', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextNum = 1
  if (lastRechnung?.rechnungs_nr) {
    const match = lastRechnung.rechnungs_nr.match(/(\d{4})$/)
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
  // Hole Fahrzeug-FIN (optional)
  let finTail = ''
  if (fahrzeugId) {
    const { data: fahrzeug } = await supabase
      .from('fahrzeuge')
      .select('fahrgestellnummer')
      .eq('id', fahrzeugId)
      .maybeSingle()

    if (fahrzeug?.fahrgestellnummer) {
      finTail = fahrzeug.fahrgestellnummer.slice(-6).toUpperCase() + '-'
    }
  }

  const year = new Date().getFullYear().toString().slice(-2)

  const { data: lastVv } = await supabase
    .from('vorvertraege')
    .select('nummer')
    .eq('betrieb_id', betriebId)
    .ilike('nummer', `VV-${year}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextNum = 1
  if (lastVv?.nummer) {
    const match = lastVv.nummer.match(/(\d{4})$/)
    if (match) nextNum = parseInt(match[1]) + 1
  }

  return `VV-${finTail}${year}${String(nextNum).padStart(4, '0')}`
}
