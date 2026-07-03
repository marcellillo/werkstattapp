import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getNextRechnungsnummer,
  generateFahrzeugRechnungHtml,
  type FahrzeugRechnungDaten,
} from '@/lib/fahrzeug-rechnung-generator'

export async function POST(req: NextRequest) {
  try {
    const { auftragId } = await req.json()
    if (!auftragId) return NextResponse.json({ error: 'auftragId required' }, { status: 400 })

    const supabase = await createClient()

    // 1. Auftrag + Fahrzeug laden
    const { data: auftrag, error: auftragError } = await supabase
      .from('auftraege')
      .select(`
        id, einnahmen, steuerart, verkauft_am, kaeufer_name,
        fahrzeug:fahrzeuge(
          id, marke, modell, baujahr, farbe, kilometerstand,
          fahrgestellnummer, verkaufspreis, einkaufspreis, bilder_urls
        ),
        kunde:kunden(email)
      `)
      .eq('id', auftragId)
      .single()

    if (auftragError || !auftrag) {
      return NextResponse.json(
        { error: 'Auftrag nicht gefunden' },
        { status: 404 }
      )
    }

    // Nur für Eigenfahrzeuge
    const fz = auftrag.fahrzeug as any
    if (!fz || fz.fahrzeug_typ !== 'eigen') {
      return NextResponse.json(
        { error: 'Nur Eigenfahrzeug-Rechnungen unterstützt' },
        { status: 400 }
      )
    }

    // 2. Rechnungsnummer
    const rechnungsnummer = await getNextRechnungsnummer()

    // 3. Firmen-Daten laden
    const { data: configRows } = await supabase
      .from('werkstatt_einstellungen')
      .select('schluessel, wert')

    const cfg: Record<string, string> = {}
    for (const row of configRows ?? []) {
      if (row.wert) cfg[row.schluessel] = row.wert
    }

    const firmaDaten = {
      name: cfg.firma_name ?? 'Werkstatt',
      strasse: cfg.firma_strasse,
      plz: cfg.firma_plz,
      ort: cfg.firma_ort,
      email: cfg.firma_email,
      telefon: cfg.firma_telefon,
      ustId: cfg.firma_ust_id,
      steuernummer: cfg.firma_steuernummer,
    }

    // 4. Rechnungs-Daten zusammenbauen
    let bilder = []
    try {
      if (fz.bilder_urls) bilder = JSON.parse(fz.bilder_urls)
    } catch {}

    const daten: FahrzeugRechnungDaten = {
      auftragId: auftrag.id,
      fahrzeugId: fz.id,
      fahrzeugMarke: fz.marke,
      fahrzeugModell: fz.modell,
      fahrzeugBaujahr: fz.baujahr,
      fahrzeugFarbe: fz.farbe,
      fahrzeugKm: fz.kilometerstand,
      fahrzeugFahrgestellnummer: fz.fahrgestellnummer,
      verkaufspreis: auftrag.einnahmen ?? fz.verkaufspreis ?? 0,
      einkaufspreis: fz.einkaufspreis,
      steuerart: auftrag.steuerart ?? 'differenz',
      kaeuferName: auftrag.kaeufer_name,
      kaeuferEmail: (auftrag.kunde as any)?.email,
      verkauftAm: auftrag.verkauft_am ?? new Date().toISOString(),
      bilderUrl: bilder,
    }

    // 5. HTML generieren
    const html = generateFahrzeugRechnungHtml(daten, rechnungsnummer, firmaDaten)

    // 6. In DB speichern
    const { data: rechnung, error: insertError } = await supabase
      .from('fahrzeug_rechnungen')
      .insert({
        auftrag_id: auftragId,
        fahrzeug_id: fz.id,
        rechnungsnummer,
        // pdf_url wird später gesetzt falls wir echte PDFs generieren
      })
      .select()
      .single()

    if (insertError || !rechnung) {
      return NextResponse.json(
        { error: 'Fehler beim Speichern der Rechnung' },
        { status: 500 }
      )
    }

    // 7. E-Mail vorbereiten (später: Outlook-Integration)
    // Für jetzt: nur HTML zurückgeben
    const downloadUrl = `/api/rechnungen/fahrzeug/${rechnung.id}/download`

    return NextResponse.json({
      success: true,
      rechnungsnummer,
      html,
      downloadUrl,
      kaeuferEmail: daten.kaeuferEmail,
      message: 'Rechnung erstellt. E-Mail-Versand wird vorbereitet...',
    })
  } catch (error) {
    console.error('Fehler beim Generieren der Rechnung:', error)
    return NextResponse.json(
      { error: 'Fehler beim Generieren der Rechnung' },
      { status: 500 }
    )
  }
}
