import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Farb-/Kraftstoff-Mappings (Mobile.de → Deutsch)
const FARBE: Record<string, string> = {
  BLACK: 'Schwarz', WHITE: 'Weiß', SILVER: 'Silber', GREY: 'Grau', GRAY: 'Grau',
  BLUE: 'Blau', RED: 'Rot', GREEN: 'Grün', YELLOW: 'Gelb', ORANGE: 'Orange',
  BROWN: 'Braun', GOLD: 'Gold', VIOLET: 'Violett', BEIGE: 'Beige', BRONZE: 'Bronze',
  PURPLE: 'Lila', PINK: 'Pink',
}
const KRAFTSTOFF: Record<string, string> = {
  DIESEL: 'Diesel', PETROL: 'Benzin', ELECTRIC: 'Elektro',
  HYBRID_DIESEL: 'Hybrid (Diesel)', HYBRID_PETROL: 'Hybrid (Benzin)', HYBRID: 'Hybrid',
  NATURAL_GAS: 'Erdgas (CNG)', CNG: 'CNG', LPG: 'Flüssiggas (LPG)', HYDROGEN: 'Wasserstoff',
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const { data: userBetriebe } = await supabase
      .from('betrieb_users')
      .select('betrieb_id')
      .eq('profile_id', user.id)
      .order('is_primary', { ascending: false })
      .limit(1)
    if (!userBetriebe?.[0]?.betrieb_id) {
      return NextResponse.json({ error: 'Kein Betrieb zugeordnet' }, { status: 403 })
    }
    const betriebId = userBetriebe[0].betrieb_id

    let ads: any[]
    try {
      const body = await req.json()
      ads = Array.isArray(body?.ads) ? body.ads : []
    } catch (e) {
      console.error('[Mobile Import] JSON parse error:', e)
      return NextResponse.json({ error: 'Ungültige JSON-Daten' }, { status: 400 })
    }
    if (ads.length === 0) return NextResponse.json({ error: 'Keine Fahrzeuge in der Datei' }, { status: 400 })

    console.log(`[Mobile Import] Importing ${ads.length} vehicles for betriebId=${betriebId}`)

  // Bestehende Eigenfahrzeuge laden (für Dedupe nach B-Nr ODER VIN)
  const { data: vorhandene } = await supabase
    .from('fahrzeuge')
    .select('id, mobile_de_id, fahrgestellnummer')
    .eq('fahrzeug_typ', 'eigen')
    .eq('betrieb_id', betriebId)

  const byBNr = new Map<string, string>()
  const byVin = new Map<string, string>()
  for (const f of vorhandene ?? []) {
    if (f.mobile_de_id) byBNr.set(f.mobile_de_id, f.id)
    if (f.fahrgestellnummer) byVin.set(f.fahrgestellnummer, f.id)
  }

  let importiert = 0, aktualisiert = 0, uebersprungen = 0
  const fehler: string[] = []
  const uebersprungenGruende: string[] = []

  for (const [index, ad] of ads.entries()) {
    // Flexible Spalten-Namen (case-insensitive) — deckt sowohl den alten
    // JSON-Export als auch den ECHTEN Mobile.de-CSV-Export mit deutschen
    // Spaltennamen ab ("Interne Nr.", "FIN", "Erstzulassung", "Kilometerstand",
    // "Leistung (kW)", "Hubraum (ccm)", "Preis (EUR, brutto)", "Aussenfarbe",
    // "Kraftstoff", "Modellbezeichnung", "Alle Bilder (URLs)"). Die alten Keys
    // bleiben als Fallback erhalten, falls mal ein anderes Format reinkommt.
    const bNummer: string | null = ad.internalnumber || ad.internalNumber || ad['b-nummer'] || ad['B-Nummer'] || ad['interne nr.'] || ad.id || null
    const vin: string | null = ad.vin || ad.fin || ad['fin'] || null
    const make = (ad.make || ad.marke || '').replace(/-/g, ' ')
    const makeCap = make ? make.charAt(0) + make.slice(1).toLowerCase() : ''
    const model = ad.modellbezeichnung || ad.modeldescription || ad.modelDescription || ad.model || ad.modell || ''
    if (!model || model === 'undefined') {
      uebersprungen++
      const spalten = Object.keys(ad).join(', ')
      uebersprungenGruende.push(`Zeile ${index + 2}${bNummer ? ` (${bNummer})` : ''}: kein Modell-Feld erkannt — gefundene Spalten: ${spalten || '(keine)'}`)
      continue
    }

    // Erstzulassung: JSON-Export liefert "YYYY-MM-DD…", die echte Mobile.de-CSV
    // liefert "MM/YYYY" (z.B. "01/2021") — Jahr robust aus beiden Formaten holen
    const erstzulassungRaw = ad.firstregistration || ad.firstRegistration || ad.erstzulassung || null
    let baujahr: number | null = null
    if (erstzulassungRaw) {
      const s = String(erstzulassungRaw)
      const jahr = s.includes('/') ? parseInt(s.slice(-4)) : parseInt(s.slice(0, 4))
      baujahr = Number.isFinite(jahr) && jahr > 1900 ? jahr : null
    }
    // Handle both JSON (price.consumerPriceGross object) and CSV (price string)
    const priceValue = typeof ad.price === 'object' ? ad.price?.consumerPriceGross : (ad.price ?? ad['preis (eur, brutto)'])
    const preis = priceValue ? parseFloat(String(priceValue)) : null
    // Handle both JSON (array) and CSV (pipe-separated string) for images
    let bilder: string[] = []
    const imagesRaw = ad.images ?? ad['alle bilder (urls)'] ?? null
    if (typeof imagesRaw === 'string' && imagesRaw) {
      bilder = imagesRaw.split('|').map((s: string) => s.trim()).filter(Boolean)
    } else if (Array.isArray(imagesRaw)) {
      bilder = imagesRaw.map((img: any) => img.ref).filter(Boolean)
    }
    const exteriorColor = ad.exteriorcolor || ad.exteriorColor || ad.aussenfarbe
    const fuel = ad.fuel || ad.kraftstoff
    const farbe = FARBE[exteriorColor] || exteriorColor || null
    const kraftstoff = KRAFTSTOFF[fuel] || fuel || null
    const kmRaw = ad.mileage ?? ad.kilometerstand ?? null
    const km = kmRaw ? parseInt(String(kmRaw), 10) : null
    const leistungRaw = ad.power ?? ad['leistung (kw)'] ?? null
    const hubraumRaw = ad.cubicCapacity ?? ad.cubiccapacity ?? ad.hubraum ?? ad['hubraum (ccm)'] ?? null

    const gemeinsam = {
      marke: makeCap,
      modell: model,
      baujahr,
      kilometerstand: km,
      farbe,
      motortyp: kraftstoff,
      hubraum: hubraumRaw ? String(hubraumRaw) : null,
      leistung_kw: leistungRaw ? parseInt(String(leistungRaw), 10) : null,
      verkaufspreis: preis,
      bilder_urls: bilder.length > 0 ? JSON.stringify(bilder) : null,
      notizen: preis ? `Verkaufspreis: ${preis.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € (Brutto)` : null,
    }

    // Existiert bereits? (B-Nr zuerst, dann VIN)
    const vorhandeneId = (bNummer && byBNr.get(bNummer)) || (vin && byVin.get(vin)) || null

    if (vorhandeneId) {
      const updateData = {
        ...gemeinsam,
        kennzeichen: bNummer,
        mobile_de_id: bNummer,
      }
      console.log(`[Mobile Import] Updating ${bNummer} (ID: ${vorhandeneId}) with kennzeichen="${bNummer}"`)
      const { error } = await supabase.from('fahrzeuge').update(updateData).eq('id', vorhandeneId).eq('betrieb_id', betriebId)
      if (error) {
        console.error(`[Mobile Import] UPDATE FAILED for ${bNummer}:`, error)
        console.error(`  - betriebId: ${betriebId}`)
        console.error(`  - vehicleId: ${vorhandeneId}`)
        console.error(`  - updateData:`, updateData)
        fehler.push(`${bNummer || vin}: ${error.message}`)
      } else {
        console.log(`[Mobile Import] ✅ Successfully updated ${bNummer}`)
        aktualisiert++
      }
      continue
    }

    // Neu anlegen: fahrzeug + auftrag
    const { data: fahrzeug, error: fErr } = await supabase.from('fahrzeuge').insert({
      betrieb_id: betriebId,
      fahrzeug_typ: 'eigen',
      kennzeichen: bNummer || (vin ? vin.slice(-6).toUpperCase() : `FZ-${Date.now().toString().slice(-5)}`),
      fahrgestellnummer: vin || null,
      mobile_de_id: bNummer || null,
      ...gemeinsam,
    }).select().single()

    if (fErr || !fahrzeug) { fehler.push(`${bNummer || vin || make}: ${fErr?.message}`); continue }

    const finSuffix = vin ? vin.slice(-6).toUpperCase() : Date.now().toString().slice(-6)
    const { error: aErr } = await supabase.from('auftraege').insert({
      betrieb_id: betriebId,
      auftrag_nr: `AU-${finSuffix}`,
      fahrzeug_id: fahrzeug.id,
      kunden_id: null,
      status: 'angenommen',
    })
    if (aErr) {
      await supabase.from('fahrzeuge').delete().eq('id', fahrzeug.id)
      fehler.push(`${bNummer || vin}: ${aErr.message}`)
      continue
    }
    // in Maps aufnehmen, damit Duplikate innerhalb derselben Datei erkannt werden
    if (bNummer) byBNr.set(bNummer, fahrzeug.id)
    if (vin) byVin.set(vin, fahrzeug.id)
    importiert++
  }

    console.log(`[Mobile Import] Complete: ${importiert} new, ${aktualisiert} updated, ${uebersprungen} skipped, ${fehler.length} errors`)
    return NextResponse.json({ importiert, aktualisiert, uebersprungen, fehler, uebersprungenGruende })
  } catch (error) {
    console.error('[Mobile Import] Fatal error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unbekannter Fehler beim Import'
    }, { status: 500 })
  }
}
