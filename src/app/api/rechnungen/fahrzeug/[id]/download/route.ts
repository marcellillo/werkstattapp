import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateFahrzeugRechnungHtml,
  type FahrzeugRechnungDaten,
} from '@/lib/fahrzeug-rechnung-generator'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rechnungId = (await params).id
    const supabase = await createClient()

    // Rechnung laden
    const { data: rechnung, error: rechnungError } = await supabase
      .from('fahrzeug_rechnungen')
      .select(`
        rechnungsnummer, auftrag_id,
        auftraege!inner(
          einnahmen, steuerart, verkauft_am, kaeufer_name,
          fahrzeug:fahrzeuge(
            marke, modell, baujahr, farbe, kilometerstand,
            fahrgestellnummer, einkaufspreis, bilder_urls
          ),
          kunde:kunden(email)
        )
      `)
      .eq('id', rechnungId)
      .single()

    if (rechnungError || !rechnung) {
      return NextResponse.json(
        { error: 'Rechnung nicht gefunden' },
        { status: 404 }
      )
    }

    const auftrag = (rechnung.auftraege as any)[0]
    const fz = auftrag?.fahrzeug as any

    if (!fz) {
      return NextResponse.json(
        { error: 'Fahrzeugdaten nicht gefunden' },
        { status: 404 }
      )
    }

    // Firmen-Daten laden
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

    // Rechnungs-Daten zusammenbauen
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
      verkaufspreis: auftrag.einnahmen ?? 0,
      einkaufspreis: fz.einkaufspreis,
      steuerart: auftrag.steuerart ?? 'differenz',
      kaeuferName: auftrag.kaeufer_name,
      kaeuferEmail: auftrag.kunde?.email,
      verkauftAm: auftrag.verkauft_am,
      bilderUrl: bilder,
    }

    // HTML generieren
    const html = generateFahrzeugRechnungHtml(daten, rechnung.rechnungsnummer, firmaDaten)

    // Response als HTML (zum Anschauen/Drucken im Browser)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="Rechnung-${rechnung.rechnungsnummer}.html"`,
      },
    })
  } catch (error) {
    console.error('Fehler beim Download:', error)
    return NextResponse.json(
      { error: 'Fehler beim Download' },
      { status: 500 }
    )
  }
}
