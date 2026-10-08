import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { generateRechnungsNummer } from '@/lib/nummernvergabe'
import { syncAuftragEinnahmen } from '@/lib/auftrag-einnahmen'
import { serverFehler } from '@/lib/api-fehler'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      auftragId, betriebId, fahrzeugId, kostenvoranschlagIds, werkstattauftragIds,
      kleinteilpauschaleBetrag, sonstigesBeschreibung, sonstigesBetrag, anzeigeModus, betriebsstoffe,
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

    // Betriebsstoffe (Motoröl, Wischwasser, ...): Liter je Stoff. Doppelte Einträge desselben
    // Stoffs werden zusammengefasst; der Literpreis kommt immer aus der Datenbank.
    const betriebsstoffMengen = new Map<string, number>()
    for (const b of Array.isArray(betriebsstoffe) ? betriebsstoffe : []) {
      const id = String(b?.betriebsstoffId ?? '')
      const menge = Math.round((Number(b?.menge) || 0) * 100) / 100
      if (id && menge > 0) betriebsstoffMengen.set(id, (betriebsstoffMengen.get(id) ?? 0) + menge)
    }

    if (waIds.length === 0 && kvIds.length === 0 && kleinteilBetrag <= 0 && sonstigesBetragZahl <= 0 && betriebsstoffMengen.size === 0) {
      return NextResponse.json(
        { error: 'Bitte mindestens einen Kostenvoranschlag, Werkstattauftrag, Betriebsstoff oder Zusatzposten auswählen' },
        { status: 400 }
      )
    }

    let betriebsstoffZeilen: any[] = []
    let betriebsstoffeSumme = 0
    if (betriebsstoffMengen.size > 0) {
      const { data: stoffe, error: stoffError } = await supabase
        .from('betriebsstoffe')
        .select('id, name, einheit, preis_pro_einheit, einkaufspreis_pro_einheit')
        .in('id', Array.from(betriebsstoffMengen.keys()))
        .eq('betrieb_id', betriebId)
        .eq('aktiv', true)
      if (stoffError) throw stoffError

      for (const [stoffId, menge] of betriebsstoffMengen) {
        const stoff = (stoffe || []).find((s: any) => s.id === stoffId)
        if (!stoff) {
          return NextResponse.json({ error: 'Ein ausgewählter Betriebsstoff existiert nicht (mehr) oder ist deaktiviert' }, { status: 400 })
        }
        const preis = Number(stoff.preis_pro_einheit) || 0
        if (preis <= 0) {
          return NextResponse.json({ error: `Für „${stoff.name}“ ist noch kein Verkaufspreis hinterlegt (Menü Betriebsstoffe → Preis ändern)` }, { status: 400 })
        }
        betriebsstoffeSumme += Math.round(menge * preis * 100) / 100
        betriebsstoffZeilen.push({
          betrieb_id: betriebId,
          betriebsstoff_id: stoff.id,
          bezeichnung: stoff.name,
          einheit: stoff.einheit,
          menge,
          preis_pro_einheit: preis,
          einkaufspreis_pro_einheit: stoff.einkaufspreis_pro_einheit,
        })
      }
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

    const summeNetto = arbeitszeitenSumme + ersatzteileSumme + kleinteilBetrag + sonstigesBetragZahl + betriebsstoffeSumme

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

    // Betriebsstoff-Zeilen der Rechnung speichern (sie sind zugleich der Verkaufsnachweis für
    // den Bestand). Scheitert das, wird die gerade angelegte Rechnung wieder entfernt -- sonst
    // stünde ein Gesamtbetrag ohne die zugehörigen Positionen in der Datenbank.
    if (betriebsstoffZeilen.length > 0) {
      const { error: zeilenError } = await supabase
        .from('rechnung_betriebsstoffe')
        .insert(betriebsstoffZeilen.map(z => ({ ...z, rechnung_id: rechnung.id })))
      if (zeilenError) {
        console.error('[Rechnung] Betriebsstoffe speichern fehlgeschlagen:', zeilenError)
        // Server-Aufräumen (die Aufbewahrungs-Sperre gilt für Nutzer-Sitzungen, nicht für diesen Rückbau)
        await createAdminClient().from('kunden_rechnungen').delete().eq('id', rechnung.id)
        throw new Error(`Betriebsstoffe konnten nicht gespeichert werden: ${zeilenError.message}`)
      }
    }

    // Ausgewählte Kostenvoranschläge/Werkstattaufträge als "abgerechnet" markieren,
    // damit sie bei einer weiteren Rechnung für diesen Auftrag nicht erneut mitgezählt werden
    if (validKvIds.length > 0) {
      await supabase.from('kostenvoranschlaege').update({ rechnung_id: rechnung.id }).in('id', validKvIds)
    }
    if (validWaIds.length > 0) {
      await supabase.from('werkstattauftraege').update({ rechnung_id: rechnung.id }).in('id', validWaIds)
    }

    await syncAuftragEinnahmen(supabase, auftragId, betriebId)

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
    return serverFehler(error, 'rechnung/create')
  }
}
