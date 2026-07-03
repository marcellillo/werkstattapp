/**
 * Ergänzt fehlende Bilder (und Restdaten) bei Eigenfahrzeugen aus public/mobile-bestand.json.
 * Match per B-Nummer (mobile_de_id) ODER VIN (fahrgestellnummer).
 * Überschreibt nur leere Felder; bilder_urls wird gesetzt, wenn bisher leer.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(join(root, '.env.local'), 'utf8')
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim()
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'))

const FARBE = { BLACK:'Schwarz',WHITE:'Weiß',SILVER:'Silber',GREY:'Grau',GRAY:'Grau',BLUE:'Blau',RED:'Rot',GREEN:'Grün',YELLOW:'Gelb',ORANGE:'Orange',BROWN:'Braun',GOLD:'Gold',VIOLET:'Violett',BEIGE:'Beige',BRONZE:'Bronze',PURPLE:'Lila',PINK:'Pink' }
const KRAFTSTOFF = { DIESEL:'Diesel',PETROL:'Benzin',ELECTRIC:'Elektro',HYBRID_DIESEL:'Hybrid (Diesel)',HYBRID_PETROL:'Hybrid (Benzin)',HYBRID:'Hybrid',NATURAL_GAS:'Erdgas (CNG)',CNG:'CNG',LPG:'Flüssiggas (LPG)',HYDROGEN:'Wasserstoff' }

const ads = JSON.parse(readFileSync(join(root, 'public/mobile-bestand.json'), 'utf8')).ads || []
const adByB = {}, adByVin = {}
for (const a of ads) {
  if (a.internalNumber) adByB[a.internalNumber] = a
  if (a.vin) adByVin[a.vin] = a
}

const { data: eigen } = await sb.from('fahrzeuge')
  .select('id, kennzeichen, marke, modell, fahrgestellnummer, mobile_de_id, bilder_urls, farbe, motortyp, baujahr, kilometerstand, hubraum, leistung_kw, verkaufspreis')
  .eq('fahrzeug_typ', 'eigen')

const ohneBilder = (eigen ?? []).filter(f => {
  try { return !f.bilder_urls || JSON.parse(f.bilder_urls).length === 0 } catch { return true }
})

let gesetzt = 0, keineQuelle = []
for (const f of ohneBilder) {
  const ad = (f.mobile_de_id && adByB[f.mobile_de_id]) || (f.fahrgestellnummer && adByVin[f.fahrgestellnummer]) || null
  const bilder = ad ? (ad.images || []).map(i => i.ref).filter(Boolean) : []
  if (!ad || bilder.length === 0) { keineQuelle.push(`${f.kennzeichen || '(kein KZ)'} ${f.marke} ${f.modell}`); continue }

  const upd = { bilder_urls: JSON.stringify(bilder) }
  const preis = ad.price?.consumerPriceGross ? parseFloat(ad.price.consumerPriceGross) : null
  const vinSuffix = f.fahrgestellnummer ? f.fahrgestellnummer.slice(-6).toUpperCase() : null

  // nur leere Felder ergänzen
  if (!f.mobile_de_id && ad.internalNumber) upd.mobile_de_id = ad.internalNumber
  if ((!f.kennzeichen || f.kennzeichen === vinSuffix) && ad.internalNumber) upd.kennzeichen = ad.internalNumber
  if (f.verkaufspreis == null && preis) { upd.verkaufspreis = preis; upd.notizen = `Verkaufspreis: ${preis.toLocaleString('de-DE',{minimumFractionDigits:2})} € (Brutto)` }
  if (!f.farbe && ad.exteriorColor) upd.farbe = FARBE[ad.exteriorColor] || ad.exteriorColor
  if (!f.motortyp && ad.fuel) upd.motortyp = KRAFTSTOFF[ad.fuel] || ad.fuel
  if (!f.baujahr && ad.firstRegistration) upd.baujahr = parseInt(String(ad.firstRegistration).slice(0,4))
  if (!f.kilometerstand && ad.mileage) upd.kilometerstand = ad.mileage
  if (!f.hubraum && ad.cubicCapacity) upd.hubraum = String(ad.cubicCapacity)
  if (!f.leistung_kw && ad.power) upd.leistung_kw = ad.power

  const { error } = await sb.from('fahrzeuge').update(upd).eq('id', f.id)
  console.log(' ', error ? '✗ '+error.message : '✓', (upd.kennzeichen || f.kennzeichen || '(kein KZ)').padEnd(8), (f.marke+' '+f.modell).slice(0,30), '→', bilder.length, 'Bilder')
  if (!error) gesetzt++
}

console.log(`\n✅ ${gesetzt} Fahrzeuge mit Bildern befüllt.`)
if (keineQuelle.length) {
  console.log(`\n⚠ Keine Bilder in mobile-bestand.json für ${keineQuelle.length}:`)
  keineQuelle.forEach(k => console.log('   -', k))
}
