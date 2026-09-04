import { SupabaseClient } from '@supabase/supabase-js'

export interface RechnungPosition {
  beschreibung: string
  teilenummer?: string
  menge: number
  preis: number
  summe: number
}

export interface RechnungDetail {
  rechnung: {
    id: string
    rechnungs_nr: string
    status: string
    erstellt_am: string
    betrag_netto: number
    betrag_mwst: number
    betrag_brutto: number
    auftrag_id: string | null
  }
  auftragNr: string
  kunde: any
  fahrzeug: any
  betrieb: any
  firma: Record<string, string>
  kleinunternehmer: boolean
  ersatzteilePositionen: RechnungPosition[]
  arbeitswertePositionen: RechnungPosition[]
  ersatzteileNetto: number
  arbeitNetto: number
  kleinteilNetto: number
  sonstigesNetto: number
  sonstigesBeschreibung: string | null
}

/**
 * Lädt und rekonstruiert alle Daten einer Werkstatt-Rechnung: Kunde, Fahrzeug, Firmendaten
 * sowie die Ersatzteile-/Arbeitswerte-Positionen aus den beim Erstellen verknüpften
 * Kostenvoranschlägen und Werkstattaufträgen (rechnung_id-Verknüpfung).
 * Wird von PDF-Export, Druckansicht (System B) und E-Mail-Versand gemeinsam genutzt.
 */
export async function resolveRechnungDetail(
  supabase: SupabaseClient,
  rechnungId: string,
  betriebId: string
): Promise<RechnungDetail | null> {
  const { data: rechnung } = await supabase
    .from('kunden_rechnungen')
    .select('*')
    .eq('id', rechnungId)
    .eq('betrieb_id', betriebId)
    .maybeSingle()

  if (!rechnung) return null

  const [
    { data: kunde },
    { data: fahrzeug },
    { data: betrieb },
    { data: auftrag },
    { data: settingsRows },
  ] = await Promise.all([
    rechnung.kunde_id
      ? supabase.from('kunden').select('*').eq('id', rechnung.kunde_id).maybeSingle()
      : Promise.resolve({ data: null }),
    rechnung.fahrzeug_id
      ? supabase.from('fahrzeuge').select('*').eq('id', rechnung.fahrzeug_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('betriebe').select('*').eq('id', betriebId).maybeSingle(),
    rechnung.auftrag_id
      ? supabase.from('auftraege').select('auftrag_nr').eq('id', rechnung.auftrag_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('betrieb_einstellungen').select('schluessel, wert').eq('betrieb_id', betriebId),
  ])

  const firma: Record<string, string> = {}
  for (const row of settingsRows || []) {
    if (row.wert !== null) firma[row.schluessel] = row.wert
  }
  if (!firma.firma_name && (betrieb as any)?.name) firma.firma_name = (betrieb as any).name
  const kleinunternehmer = firma.firma_kleinunternehmer === 'ja'

  // Ersatzteile: alle Kostenvoranschläge, die dieser Rechnung zugeordnet wurden
  const { data: kostenvoranschlaege } = await supabase
    .from('kostenvoranschlaege')
    .select('id, ersatzteile_modus, ersatzteile_festpreis')
    .eq('rechnung_id', rechnungId)
    .eq('betrieb_id', betriebId)

  const ersatzteilePositionen: RechnungPosition[] = []
  for (const kv of kostenvoranschlaege || []) {
    if (kv.ersatzteile_modus === 'festpreis') {
      if ((kv.ersatzteile_festpreis || 0) > 0) {
        ersatzteilePositionen.push({
          beschreibung: 'Ersatzteile (Festpreis)',
          menge: 1,
          preis: kv.ersatzteile_festpreis,
          summe: kv.ersatzteile_festpreis,
        })
      }
    } else {
      const { data: kvPositionen } = await supabase
        .from('kostenvoranschlag_position')
        .select('*')
        .eq('kostenvoranschlag_id', kv.id)

      for (const pos of kvPositionen || []) {
        ersatzteilePositionen.push({
          beschreibung: pos.beschreibung,
          menge: pos.menge || 1,
          preis: pos.einzelpreis || 0,
          summe: pos.gesamtpreis || 0,
        })
      }
    }
  }

  // Arbeitswerte: alle Werkstattaufträge, die dieser Rechnung zugeordnet wurden
  const { data: werkstattauftraege } = await supabase
    .from('werkstattauftraege')
    .select('id')
    .eq('rechnung_id', rechnungId)
    .eq('betrieb_id', betriebId)

  const waIds = (werkstattauftraege || []).map(wa => wa.id)
  const arbeitswertePositionen: RechnungPosition[] = []
  if (waIds.length > 0) {
    const { data: waPositionen } = await supabase
      .from('werkstattauftrag_positionen')
      .select('*')
      .in('werkstattauftrag_id', waIds)

    for (const pos of waPositionen || []) {
      arbeitswertePositionen.push({
        beschreibung: pos.beschreibung,
        menge: pos.menge || 1,
        preis: pos.einzelpreis || 0,
        summe: pos.gesamtpreis || 0,
      })
    }
  }

  const ersatzteileNetto = ersatzteilePositionen.reduce((s, p) => s + p.summe, 0)
  const arbeitNetto = arbeitswertePositionen.reduce((s, p) => s + p.summe, 0)
  const kleinteilNetto = rechnung.kleinteilpauschale_betrag || 0
  const sonstigesNetto = rechnung.sonstiges_betrag || 0

  return {
    rechnung: {
      id: rechnung.id,
      rechnungs_nr: rechnung.rechnungs_nr,
      status: rechnung.status,
      erstellt_am: rechnung.erstellt_am,
      betrag_netto: rechnung.betrag_netto || 0,
      betrag_mwst: rechnung.betrag_mwst || 0,
      betrag_brutto: rechnung.betrag_brutto || 0,
      auftrag_id: rechnung.auftrag_id || null,
    },
    auftragNr: auftrag?.auftrag_nr || '',
    kunde,
    fahrzeug,
    betrieb,
    firma,
    kleinunternehmer,
    ersatzteilePositionen,
    arbeitswertePositionen,
    ersatzteileNetto,
    arbeitNetto,
    kleinteilNetto,
    sonstigesNetto,
    sonstigesBeschreibung: rechnung.sonstiges_beschreibung || null,
  }
}
