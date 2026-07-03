/**
 * Importiert alle Fahrzeuge aus public/mobile-bestand.json als Eigenfahrzeuge in Supabase.
 * Duplikate werden anhand von mobile_de_id (B-Nummer) oder VIN erkannt und übersprungen.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')

// Credentials aus .env.local lesen
const envRaw = readFileSync(join(root, '.env.local'), 'utf8')
const getEnv = key => envRaw.match(new RegExp(key + '=(.+)'))?.[1]?.trim()

const supabase = createClient(
  getEnv('NEXT_PUBLIC_SUPABASE_URL'),
  getEnv('SUPABASE_SERVICE_ROLE_KEY')
)

// ── Mappings ─────────────────────────────────────────────────────────────────

const FARBE = {
  BLACK: 'Schwarz', WHITE: 'Weiß', SILVER: 'Silber', GREY: 'Grau',
  BLUE: 'Blau', RED: 'Rot', GREEN: 'Grün', YELLOW: 'Gelb',
  ORANGE: 'Orange', BROWN: 'Braun', GOLD: 'Gold', VIOLET: 'Violett',
  BEIGE: 'Beige', BRONZE: 'Bronze', PURPLE: 'Lila', PINK: 'Pink',
}

const KRAFTSTOFF = {
  DIESEL: 'Diesel', PETROL: 'Benzin', ELECTRIC: 'Elektro',
  HYBRID_DIESEL: 'Hybrid (Diesel)', HYBRID_PETROL: 'Hybrid (Benzin)',
  NATURAL_GAS: 'Erdgas (CNG)', LPG: 'Flüssiggas (LPG)',
  HYDROGEN: 'Wasserstoff',
}

// ── Bestehende Eigenfahrzeuge laden ──────────────────────────────────────────

const { data: vorhandene } = await supabase
  .from('fahrzeuge')
  .select('mobile_de_id, fahrgestellnummer')
  .eq('fahrzeug_typ', 'eigen')

const vorhandeneIds = new Set((vorhandene ?? []).map(f => f.mobile_de_id).filter(Boolean))
const vorhandeneVins = new Set((vorhandene ?? []).map(f => f.fahrgestellnummer).filter(Boolean))

console.log(`\n▸ Vorhandene Eigenfahrzeuge: ${vorhandene?.length ?? 0}`)

// ── Fahrzeuge verarbeiten ─────────────────────────────────────────────────────

const { ads } = JSON.parse(readFileSync(join(root, 'public/mobile-bestand.json'), 'utf8'))

let importiert = 0
let übersprungen = 0
let fehler = 0

for (const ad of ads) {
  const bNummer = ad.internalNumber || null
  const vin = ad.vin || null
  const make = (ad.make || '').replace(/-/g, ' ')
  const model = ad.modelDescription || ad.model || ''

  // Harley Davidson / Motorräder ohne Modellname überspringen
  if (!model || model === 'undefined') {
    console.log(`  ⚠  Übersprungen (kein Modell): ${make}`)
    übersprungen++
    continue
  }

  // Duplikat-Prüfung: B-Nummer ODER VIN
  if (bNummer && vorhandeneIds.has(bNummer)) {
    console.log(`  ↩  Bereits vorhanden: ${bNummer} – ${make} ${model}`)
    übersprungen++
    continue
  }
  if (vin && vorhandeneVins.has(vin)) {
    console.log(`  ↩  Bereits vorhanden (VIN): ${vin.slice(-6)} – ${make} ${model}`)
    übersprungen++
    continue
  }

  // Felder aufbereiten
  const baujahr = ad.firstRegistration ? parseInt(ad.firstRegistration.slice(0, 4)) : null
  const preis = ad.price?.consumerPriceGross ? parseFloat(ad.price.consumerPriceGross) : null
  const bilder = (ad.images ?? []).map(img => img.ref).filter(Boolean)
  const farbe = FARBE[ad.exteriorColor] || ad.exteriorColor || null
  const kraftstoff = KRAFTSTOFF[ad.fuel] || ad.fuel || null

  // fahrzeuge INSERT
  const { data: fahrzeug, error: fErr } = await supabase
    .from('fahrzeuge')
    .insert({
      fahrzeug_typ: 'eigen',
      marke: make,
      modell: model,
      kennzeichen: bNummer || (vin ? vin.slice(-6).toUpperCase() : `FZ-${Date.now().toString().slice(-5)}`),
      fahrgestellnummer: vin || null,
      baujahr,
      kilometerstand: ad.mileage || null,
      farbe,
      motortyp: kraftstoff,
      hubraum: ad.cubicCapacity ? String(ad.cubicCapacity) : null,
      leistung_kw: ad.power || null,
      mobile_de_id: bNummer || null,
      bilder_urls: bilder.length > 0 ? JSON.stringify(bilder) : null,
      notizen: preis ? `Verkaufspreis: ${preis.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € (Brutto)` : null,
    })
    .select()
    .single()

  if (fErr || !fahrzeug) {
    console.error(`  ✗  Fehler Fahrzeug: ${make} ${model} —`, fErr?.message)
    fehler++
    continue
  }

  // auftraege INSERT (Status = angenommen)
  const finSuffix = vin ? vin.slice(-6).toUpperCase() : Date.now().toString().slice(-6)
  const auftragNr = `AU-${finSuffix}`

  const { error: aErr } = await supabase
    .from('auftraege')
    .insert({
      auftrag_nr: auftragNr,
      fahrzeug_id: fahrzeug.id,
      kunden_id: null,
      status: 'angenommen',
    })

  if (aErr) {
    console.error(`  ✗  Fehler Auftrag: ${make} ${model} —`, aErr.message)
    // Fahrzeug wieder löschen um inkonsistente Daten zu vermeiden
    await supabase.from('fahrzeuge').delete().eq('id', fahrzeug.id)
    fehler++
    continue
  }

  console.log(`  ✓  ${bNummer || '(kein B-Nr)'} – ${make} ${model} (${baujahr || '?'}, ${ad.mileage?.toLocaleString('de-DE') || '?'} km)`)
  importiert++
}

console.log(`\n✅ Fertig: ${importiert} importiert · ${übersprungen} übersprungen · ${fehler} Fehler\n`)
