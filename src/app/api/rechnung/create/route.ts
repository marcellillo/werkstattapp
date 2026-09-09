import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateRechnungsNummer } from '@/lib/nummernvergabe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      auftragId, betriebId, fahrzeugId, kostenvoranschlagIds, werkstattauftragIds,
      kleinteilpauschaleBetrag, sonstigesBeschreibung, sonstigesBetrag, anzeigeModus,
    } = await req.json()
    const anzeigeModusWert = anzeigeModus === 'pauschal' ? 'pauschal' : 'detailliert'

    console.log('[Rechnung] Input:', { auftragId, betriebId, fahrzeugId, kostenvoranschlagIds, werkstattauftragIds })

    if (!auftragId || !betriebId) {
      return NextResponse.json({ error: 'auftragId und betriebId erforderlich' }, { status: 400 })
    }

    // Überprüfe, ob User dieser betriebId angehört
    const { data: betriebCheck, error: checkError } = await supabase
      .from('betrieb_users')
      .select('id')
      .eq('betrieb_id', betriebId)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (checkError) throw checkError
    if (!betriebCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const waIds: string[] = Array.isArray(werkstattauftragIds) ? werkstattauftragIds : []
    const kvIds: string[] = Array.isArray(kostenvoranschlagIds) ? kostenvoranschlagIds : []
    const kleinteilBetrag: number = parseFloat(kleinteilpauschaleBetrag) || 0
    const sonstigesBetragZahl: number = parseFloat(sonstigesBetrag) || 0

    if (waIds.length === 0 && kvIds.length === 0 && kleinteilBetrag <= 0 && sonstigesBetragZahl <= 0) {
      return NextResponse.json(
        { error: 'Bitte mindestens einen Kostenvoranschlag, Werkstattauftrag oder Zusatzposten auswählen' },
        { status: 400 }
      )
    }

    // Sicherstellen, dass die ausgewählten KV/WA zu diesem Auftrag/Betrieb gehören und noch nicht abgerechnet sind
    let arbeitszeitenSumme = 0
    let validWaIds: string[] = []
    if (waIds.length > 0) {
      const { data: waRows } = await supabase
        .from('werkstattauftraege')
        .select('id')
        .in('id', waIds)
        .eq('auftrag_id', auftragId)
        .eq('betrieb_id', betriebId)
        .is('rechnung_id', null)

      validWaIds = (waRows || []).map(wa => wa.id)
      if (validWaIds.length > 0) {
        const { data: waPositionen } = await supabase
          .from('werkstattauftrag_positionen')
          .select('gesamtpreis')
          .in('werkstattauftrag_id', validWaIds)

        arbeitszeitenSumme = (waPositionen || []).reduce(
          (sum: number, pos: any) => sum + (parseFloat(pos.gesamtpreis) || 0), 0
        )
      }
    }

    let ersatzteileSumme = 0
    let validKvIds: string[] = []
    if (kvIds.length > 0) {
      const { data: kvRows } = await supabase
        .from('kostenvoranschlaege')
        .select('id, ersatzteile_modus, ersatzteile_festpreis')
        .in('id', kvIds)
        .eq('auftrag_id', auftragId)
        .eq('betrieb_id', betriebId)
        .is('rechnung_id', null)

      for (const kv of kvRows || []) {
        validKvIds.push(kv.id)
        if (kv.ersatzteile_modus === 'festpreis') {
          ersatzteileSumme += kv.ersatzteile_festpreis || 0
        } else {
          const { data: kvPositionen } = await supabase
            .from('kostenvoranschlag_position')
            .select('gesamtpreis')
            .eq('kostenvoranschlag_id', kv.id)

          ersatzteileSumme += (kvPositionen || []).reduce(
            (sum: number, pos: any) => sum + (parseFloat(pos.gesamtpreis) || 0), 0
          )
        }
      }
    }

    const summeNetto = arbeitszeitenSumme + ersatzteileSumme + kleinteilBetrag + sonstigesBetragZahl

    // Kleinunternehmerregelung (§19 UStG) berücksichtigen
    const { data: kleinunternehmerSetting } = await supabase
      .from('betrieb_einstellungen')
      .select('wert')
      .eq('betrieb_id', betriebId)
      .eq('schluessel', 'firma_kleinunternehmer')
      .maybeSingle()
    const istKleinunternehmer = kleinunternehmerSetting?.wert === 'ja'

    const summeMwst = istKleinunternehmer ? 0 : summeNetto * 0.19
    const summeBrutto = summeNetto + summeMwst

    // Generiere Nummer (diese App rechnet ausschließlich Werkstattleistungen ab)
    const rechnungsNummer = await generateRechnungsNummer(supabase, 'werkstatt', betriebId)

    // Kunde über den Auftrag ermitteln
    const { data: auftrag } = await supabase
      .from('auftraege')
      .select('kunden_id')
      .eq('id', auftragId)
      .maybeSingle()

    // Erstelle Rechnung in kunden_rechnungen
    const { data: rechnung, error } = await supabase
      .from('kunden_rechnungen')
      .insert({
        rechnungs_nr: rechnungsNummer,
        auftrag_id: auftragId,
        kunde_id: auftrag?.kunden_id || null,
        fahrzeug_id: fahrzeugId || null,
        betrieb_id: betriebId,
        betrag_netto: summeNetto,
        betrag_mwst: summeMwst,
        betrag_brutto: summeBrutto,
        kleinteilpauschale_betrag: kleinteilBetrag > 0 ? kleinteilBetrag : null,
        sonstiges_beschreibung: sonstigesBetragZahl > 0 ? (sonstigesBeschreibung || 'Sonstige Leistungen') : null,
        sonstiges_betrag: sonstigesBetragZahl > 0 ? sonstigesBetragZahl : null,
        anzeige_modus: anzeigeModusWert,
        status: 'offen',
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('[Rechnung] Insert Error:', error)
      throw error
    }
    if (!rechnung) {
      return NextResponse.json({ error: 'Rechnung konnte nicht erstellt werden' }, { status: 500 })
    }

    // Ausgewählte Kostenvoranschläge/Werkstattaufträge als "abgerechnet" markieren,
    // damit sie bei einer weiteren Rechnung für diesen Auftrag nicht erneut mitgezählt werden
    if (validKvIds.length > 0) {
      await supabase.from('kostenvoranschlaege').update({ rechnung_id: rechnung.id }).in('id', validKvIds)
    }
    if (validWaIds.length > 0) {
      await supabase.from('werkstattauftraege').update({ rechnung_id: rechnung.id }).in('id', validWaIds)
    }

    console.log('[Rechnung] ✅ Erstellt:', rechnungsNummer)

    return NextResponse.json({
      erfolg: true,
      rechnung: {
        id: rechnung?.id,
        nummer: rechnungsNummer,
        status: 'offen',
      }
    })
  } catch (error: any) {
    console.error('[Rechnung] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
