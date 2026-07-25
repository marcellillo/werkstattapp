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

  for (const ad of ads) {
    // Flexible Spalten-Namen für B-Nummer (case-insensitive für CSV-Parser)
    const bNummer: string | null = ad.internalnumber || ad.internalNumber || ad['b-nummer'] || ad['B-Nummer'] || ad.id || null
    const vin: string | null = ad.vin || ad['vin'] || null
    const make = (ad.make || ad.marke || '').replace(/-/g, ' ')
    const makeCap = make ? make.charAt(0) + make.slice(1).toLowerCase() : ''
    const model = ad.modeldescription || ad.modelDescription || ad.model || ad.modell || ''
    if (!model || model === 'undefined') { uebersprungen++; continue }

    const baujahr = ad.firstregistration || ad.firstRegistration ? parseInt(String(ad.firstregistration || ad.firstRegistration).slice(0, 4)) : null
    // Handle both JSON (price.consumerPriceGross object) and CSV (price string)
    const priceValue = typeof ad.price === 'object' ? ad.price?.consumerPriceGross : ad.price
    const preis = priceValue ? parseFloat(String(priceValue)) : null
    // Handle both JSON (array) and CSV (pipe-separated string) for images
    let bilder: string[] = []
    if (typeof ad.images === 'string' && ad.images) {
      bilder = ad.images.split('|').filter(Boolean)
    } else if (Array.isArray(ad.images)) {
      bilder = ad.images.map((img: any) => img.ref).filter(Boolean)
    }
    const exteriorColor = ad.exteriorcolor || ad.exteriorColor
    const fuel = ad.fuel
    const farbe = FARBE[exteriorColor] || exteriorColor || null
    const kraftstoff = KRAFTSTOFF[fuel] || fuel || null
    const km = ad.mileage || null

    const gemeinsam = {
      marke: makeCap,
      modell: model,
      baujahr,
      kilometerstand: km,
      farbe,
      motortyp: kraftstoff,
      hubraum: ad.cubicCapacity ? String(ad.cubicCapacity) : null,
      leistung_kw: ad.power || null,
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
    return NextResponse.json({ importiert, aktualisiert, uebersprungen, fehler })
  } catch (error) {
    console.error('[Mobile Import] Fatal error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unbekannter Fehler beim Import'
    }, { status: 500 })
  }
}
