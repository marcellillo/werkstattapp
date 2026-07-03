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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  let ads: any[]
  try {
    const body = await req.json()
    ads = Array.isArray(body?.ads) ? body.ads : []
  } catch {
    return NextResponse.json({ error: 'Ungültige JSON-Daten' }, { status: 400 })
  }
  if (ads.length === 0) return NextResponse.json({ error: 'Keine Fahrzeuge in der Datei' }, { status: 400 })

  // Bestehende Eigenfahrzeuge laden (für Dedupe nach B-Nr ODER VIN)
  const { data: vorhandene } = await supabase
    .from('fahrzeuge')
    .select('id, mobile_de_id, fahrgestellnummer')
    .eq('fahrzeug_typ', 'eigen')

  const byBNr = new Map<string, string>()
  const byVin = new Map<string, string>()
  for (const f of vorhandene ?? []) {
    if (f.mobile_de_id) byBNr.set(f.mobile_de_id, f.id)
    if (f.fahrgestellnummer) byVin.set(f.fahrgestellnummer, f.id)
  }

  let importiert = 0, aktualisiert = 0, uebersprungen = 0
  const fehler: string[] = []

  for (const ad of ads) {
    const bNummer: string | null = ad.internalNumber || null
    const vin: string | null = ad.vin || null
    const make = (ad.make || '').replace(/-/g, ' ')
    const makeCap = make ? make.charAt(0) + make.slice(1).toLowerCase() : ''
    const model = ad.modelDescription || ad.model || ''
    if (!model || model === 'undefined') { uebersprungen++; continue }

    const baujahr = ad.firstRegistration ? parseInt(String(ad.firstRegistration).slice(0, 4)) : null
    const preis = ad.price?.consumerPriceGross ? parseFloat(ad.price.consumerPriceGross) : null
    const bilder = (ad.images ?? []).map((img: any) => img.ref).filter(Boolean)
    const farbe = FARBE[ad.exteriorColor] || ad.exteriorColor || null
    const kraftstoff = KRAFTSTOFF[ad.fuel] || ad.fuel || null

    const gemeinsam = {
      marke: makeCap,
      modell: model,
      baujahr,
      kilometerstand: ad.mileage || null,
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
      const { error } = await supabase.from('fahrzeuge').update({
        ...gemeinsam,
        mobile_de_id: bNummer || undefined,
      }).eq('id', vorhandeneId)
      if (error) fehler.push(`${bNummer || vin}: ${error.message}`)
      else aktualisiert++
      continue
    }

    // Neu anlegen: fahrzeug + auftrag
    const { data: fahrzeug, error: fErr } = await supabase.from('fahrzeuge').insert({
      fahrzeug_typ: 'eigen',
      kennzeichen: bNummer || (vin ? vin.slice(-6).toUpperCase() : `FZ-${Date.now().toString().slice(-5)}`),
      fahrgestellnummer: vin || null,
      mobile_de_id: bNummer || null,
      ...gemeinsam,
    }).select().single()

    if (fErr || !fahrzeug) { fehler.push(`${bNummer || vin || make}: ${fErr?.message}`); continue }

    const finSuffix = vin ? vin.slice(-6).toUpperCase() : Date.now().toString().slice(-6)
    const { error: aErr } = await supabase.from('auftraege').insert({
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

  return NextResponse.json({ importiert, aktualisiert, uebersprungen, fehler })
}
