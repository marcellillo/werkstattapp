/**
 * Importiert Fahrzeuge direkt aus einer Mobile.de-CSV-Exportdatei nach Supabase
 * (kein Umweg über die Bestand-Seite/Browser nötig).
 *
 * Erkennt die ECHTEN deutschen Mobile.de-Spaltennamen:
 *   Interne Nr., Marke, Modell, Modellbezeichnung, Erstzulassung, Kilometerstand,
 *   Leistung (kW), Hubraum (ccm), Kraftstoff, Aussenfarbe, Preis (EUR, brutto),
 *   FIN, Alle Bilder (URLs)
 *
 * Standard: DRY-RUN (zeigt nur, was passieren würde). Mit Argument "apply" wird
 * wirklich in Supabase geschrieben.
 *
 * Aufruf:
 *   node scripts/import-mobile-csv.mjs <pfad-zur-csv>            (nur anzeigen)
 *   node scripts/import-mobile-csv.mjs <pfad-zur-csv> apply      (wirklich importieren)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const APPLY = process.argv.includes('apply')
const csvArg = process.argv.slice(2).find(a => a !== 'apply')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const csvPath = csvArg ? join(process.cwd(), csvArg) : join(root, 'scripts', 'mobile-export.csv')

const env = readFileSync(join(root, '.env.local'), 'utf8')
const getEnv = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim()
const sb = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

const FARBE = {
  BLACK: 'Schwarz', WHITE: 'Weiß', SILVER: 'Silber', GREY: 'Grau', GRAY: 'Grau',
  BLUE: 'Blau', RED: 'Rot', GREEN: 'Grün', YELLOW: 'Gelb', ORANGE: 'Orange',
  BROWN: 'Braun', GOLD: 'Gold', VIOLET: 'Violett', BEIGE: 'Beige', BRONZE: 'Bronze',
  PURPLE: 'Lila', PINK: 'Pink',
}
const KRAFTSTOFF = {
  DIESEL: 'Diesel', PETROL: 'Benzin', ELECTRIC: 'Elektro',
  HYBRID_DIESEL: 'Hybrid (Diesel)', HYBRID_PETROL: 'Hybrid (Benzin)', HYBRID: 'Hybrid',
  NATURAL_GAS: 'Erdgas (CNG)', CNG: 'CNG', LPG: 'Flüssiggas (LPG)', HYDROGEN: 'Wasserstoff',
}

// ── CSV parsen (Semikolon-getrennt, quoted fields) ──────────────────────────
function parseCSVLine(line, delimiter) {
  const values = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') inQuotes = !inQuotes
    else if (char === delimiter && !inQuotes) { values.push(current.trim().replace(/^"|"$/g, '')); current = '' }
    else current += char
  }
  values.push(current.trim().replace(/^"|"$/g, ''))
  return values
}

let raw = readFileSync(csvPath, 'utf8')
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1) // BOM entfernen
const lines = raw.split('\n').filter(l => l.trim())
if (lines.length < 2) { console.error('CSV ist leer oder hat nur eine Kopfzeile.'); process.exit(1) }

const kommas = (lines[0].match(/,/g) || []).length
const semikolons = (lines[0].match(/;/g) || []).length
const delimiter = semikolons > kommas ? ';' : ','

const headers = parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase())
const ads = lines.slice(1).map(line => {
  const values = parseCSVLine(line, delimiter)
  const ad = {}
  headers.forEach((h, i) => { ad[h] = values[i] || null })
  return ad
})

console.log(`\n${'='.repeat(70)}`)
console.log(`  MOBILE.DE CSV IMPORT ${APPLY ? '»» AUSFÜHRUNG ««' : '(DRY-RUN — nichts wird geschrieben)'}`)
console.log('='.repeat(70))
console.log(`Quelle: ${csvPath}`)
console.log(`Gefunden: ${ads.length} Fahrzeuge\n`)

// ── betrieb_id ermitteln ─────────────────────────────────────────────────────
const { data: betriebe, error: betriebeErr } = await sb.from('betriebe').select('id, name')
if (betriebeErr) { console.error('Fehler beim Laden der Betriebe:', betriebeErr.message); process.exit(1) }
if (!betriebe || betriebe.length === 0) { console.error('Kein Betrieb gefunden.'); process.exit(1) }
if (betriebe.length > 1) {
  console.error('Mehrere Betriebe gefunden — bitte betrieb_id manuell setzen:')
  betriebe.forEach(b => console.error(`  - ${b.id}  (${b.name})`))
  process.exit(1)
}
const betriebId = betriebe[0].id
console.log(`Betrieb: ${betriebe[0].name} (${betriebId})\n`)

// ── Bestehende Eigenfahrzeuge laden (Dedupe über B-Nr ODER VIN) ──────────────
const { data: vorhandene } = await sb
  .from('fahrzeuge')
  .select('id, mobile_de_id, fahrgestellnummer')
  .eq('fahrzeug_typ', 'eigen')
  .eq('betrieb_id', betriebId)

const byBNr = new Map()
const byVin = new Map()
for (const f of vorhandene ?? []) {
  if (f.mobile_de_id) byBNr.set(f.mobile_de_id, f.id)
  if (f.fahrgestellnummer) byVin.set(f.fahrgestellnummer, f.id)
}

let importiert = 0, aktualisiert = 0, uebersprungen = 0
const fehler = []

for (const [index, ad] of ads.entries()) {
  const bNummer = ad['interne nr.'] || ad.internalnumber || ad['b-nummer'] || null
  const vin = ad.fin || ad.vin || null
  const make = (ad.marke || ad.make || '').replace(/-/g, ' ')
  const makeCap = make ? make.charAt(0) + make.slice(1).toLowerCase() : ''
  const model = ad.modellbezeichnung || ad.modell || ad.model || ''

  if (!model || model === 'undefined') {
    uebersprungen++
    console.log(`  ⚠  Zeile ${index + 2}${bNummer ? ` (${bNummer})` : ''}: kein Modell erkannt — übersprungen`)
    continue
  }

  const erstzulassungRaw = ad.erstzulassung || ad.firstregistration || null
  let baujahr = null
  if (erstzulassungRaw) {
    const s = String(erstzulassungRaw)
    const jahr = s.includes('/') ? parseInt(s.slice(-4)) : parseInt(s.slice(0, 4))
    baujahr = Number.isFinite(jahr) && jahr > 1900 ? jahr : null
  }

  const priceRaw = ad['preis (eur, brutto)'] || ad.price || null
  const preis = priceRaw ? parseFloat(String(priceRaw)) : null

  const imagesRaw = ad['alle bilder (urls)'] || ad.images || null
  const bilder = imagesRaw ? String(imagesRaw).split('|').map(s => s.trim()).filter(Boolean) : []

  const exteriorColor = ad.aussenfarbe || ad.exteriorcolor || null
  const fuel = ad.kraftstoff || ad.fuel || null
  const farbe = FARBE[exteriorColor] || exteriorColor || null
  const kraftstoff = KRAFTSTOFF[fuel] || fuel || null
  const kmRaw = ad.kilometerstand || ad.mileage || null
  const km = kmRaw ? parseInt(String(kmRaw), 10) : null
  const leistungRaw = ad['leistung (kw)'] || ad.power || null
  const hubraumRaw = ad['hubraum (ccm)'] || ad.hubraum || null

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

  const vorhandeneId = (bNummer && byBNr.get(bNummer)) || (vin && byVin.get(vin)) || null

  if (vorhandeneId) {
    console.log(`  🔄 ${bNummer || vin} – ${makeCap} ${model} (Update, ${bilder.length} Bilder)`)
    if (APPLY) {
      const { error } = await sb.from('fahrzeuge')
        .update({ ...gemeinsam, kennzeichen: bNummer, mobile_de_id: bNummer })
        .eq('id', vorhandeneId).eq('betrieb_id', betriebId)
      if (error) { fehler.push(`${bNummer || vin}: ${error.message}`); continue }
    }
    aktualisiert++
    continue
  }

  console.log(`  ✅ ${bNummer || '(keine B-Nr)'} – ${makeCap} ${model} (Neu, ${bilder.length} Bilder)`)
  if (APPLY) {
    const { data: fahrzeug, error: fErr } = await sb.from('fahrzeuge').insert({
      betrieb_id: betriebId,
      fahrzeug_typ: 'eigen',
      kennzeichen: bNummer || (vin ? vin.slice(-6).toUpperCase() : `FZ-${Date.now().toString().slice(-5)}`),
      fahrgestellnummer: vin || null,
      mobile_de_id: bNummer || null,
      ...gemeinsam,
    }).select().single()

    if (fErr || !fahrzeug) { fehler.push(`${bNummer || vin || make}: ${fErr?.message}`); continue }

    const finSuffix = vin ? vin.slice(-6).toUpperCase() : Date.now().toString().slice(-6)
    const { error: aErr } = await sb.from('auftraege').insert({
      betrieb_id: betriebId,
      auftrag_nr: `AU-${finSuffix}`,
      fahrzeug_id: fahrzeug.id,
      kunden_id: null,
      status: 'angenommen',
    })
    if (aErr) {
      await sb.from('fahrzeuge').delete().eq('id', fahrzeug.id)
      fehler.push(`${bNummer || vin}: ${aErr.message}`)
      continue
    }
    if (bNummer) byBNr.set(bNummer, fahrzeug.id)
    if (vin) byVin.set(vin, fahrzeug.id)
  }
  importiert++
}

console.log(`\n✅ ${APPLY ? 'Fertig' : 'Vorschau'}: ${importiert} neu, ${aktualisiert} aktualisiert, ${uebersprungen} übersprungen, ${fehler.length} Fehler`)
if (fehler.length) { console.log('\nFehler:'); fehler.forEach(f => console.log(`  ❌ ${f}`)) }
if (!APPLY) console.log(`\n→ Zum wirklichen Importieren:  node scripts/import-mobile-csv.mjs ${csvArg || 'scripts/mobile-export.csv'} apply\n`)
