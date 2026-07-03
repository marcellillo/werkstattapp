/**
 * Bereinigt Duplikate im Eigenfahrzeug-Bestand.
 * Gruppiert nach VIN (fahrgestellnummer). Pro Gruppe:
 *   - wählt einen Keeper (bevorzugt: hat Auftrag > hat Bilder+B-Nr > echtes KZ)
 *   - überträgt fehlende Felder (bilder_urls, mobile_de_id, verkaufspreis, KZ) in den Keeper
 *   - löscht Duplikate + deren Aufträge — ABER nur wenn deren Auftrag 'angenommen' ist
 *   - Duplikate mit fortgeschrittenem Auftrag (fertig/verkauft/ausgeliefert) → MANUELL prüfen
 *   - hat der Keeper keinen Auftrag, wird einer angelegt (status 'angenommen')
 *
 * Standard: DRY-RUN (zeigt nur den Plan). Mit Argument "apply" wird ausgeführt.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const APPLY = process.argv.includes('apply')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(join(root, '.env.local'), 'utf8')
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim()
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'))

const ADVANCED = new Set(['fertig', 'verkauft', 'ausgeliefert'])

const { data: fahrzeuge, error: fzErr } = await sb.from('fahrzeuge')
  .select('id, kennzeichen, marke, modell, fahrgestellnummer, mobile_de_id, bilder_urls, notizen, erstellt_am')
  .eq('fahrzeug_typ', 'eigen')
if (fzErr) { console.error('Fehler beim Laden:', fzErr.message); process.exit(1) }
const { data: auftraege } = await sb.from('auftraege').select('id, fahrzeug_id, status')

const auftragByFz = {}
for (const a of auftraege ?? []) (auftragByFz[a.fahrzeug_id] = auftragByFz[a.fahrzeug_id] || []).push(a)

// Score: höher = besserer Keeper
function score(f) {
  const auf = auftragByFz[f.id] ?? []
  let s = 0
  if (auf.some(a => ADVANCED.has(a.status))) s += 1000
  else if (auf.length > 0) s += 500
  if (f.mobile_de_id) s += 40
  if (f.bilder_urls) s += 20
  if (f.kennzeichen && f.mobile_de_id && f.kennzeichen === f.mobile_de_id) s += 10
  else if (f.kennzeichen && !/^FZ-|^\w{6}$/.test(f.kennzeichen)) s += 5
  return s
}

// Gruppieren nach VIN (nur Zeilen mit VIN — ohne VIN kein sicheres Dedupe)
const byVin = {}
const ohneVin = []
for (const f of fahrzeuge ?? []) {
  if (f.fahrgestellnummer) (byVin[f.fahrgestellnummer] = byVin[f.fahrgestellnummer] || []).push(f)
  else ohneVin.push(f)
}

let planLoeschen = 0, planMerge = 0, planNeuerAuftrag = 0, manuell = 0
const aktionen = []

for (const [vin, gruppe] of Object.entries(byVin)) {
  if (gruppe.length < 2) continue
  gruppe.sort((a, b) => score(b) - score(a) || (a.erstellt_am < b.erstellt_am ? -1 : 1))
  const keeper = gruppe[0]
  const dups = gruppe.slice(1)

  // Merge-Daten sammeln (fehlende Felder im Keeper aus Duplikaten füllen)
  const merge = {}
  for (const feld of ['mobile_de_id', 'bilder_urls', 'notizen']) {
    if (keeper[feld] == null || keeper[feld] === '') {
      const quelle = dups.find(d => d[feld] != null && d[feld] !== '')
      if (quelle) merge[feld] = quelle[feld]
    }
  }
  // Kennzeichen: falls Keeper keins/Fallback hat, echtes KZ (=B-Nr) aus Duplikat/Merge
  const bNr = keeper.mobile_de_id || merge.mobile_de_id
  if (bNr && (!keeper.kennzeichen || keeper.kennzeichen !== bNr)) merge.kennzeichen = bNr

  const keeperHatAuftrag = (auftragByFz[keeper.id] ?? []).length > 0
  const loeschbar = [], zuPruefen = []
  for (const d of dups) {
    const auf = auftragByFz[d.id] ?? []
    if (auf.some(a => ADVANCED.has(a.status))) zuPruefen.push({ d, auf })
    else loeschbar.push({ d, auf })
  }

  aktionen.push({ vin, keeper, merge, loeschbar, zuPruefen, keeperHatAuftrag })
  planLoeschen += loeschbar.length
  if (Object.keys(merge).length) planMerge++
  if (!keeperHatAuftrag) planNeuerAuftrag++
  manuell += zuPruefen.length
}

// ── Ausgabe ──────────────────────────────────────────────────────
console.log(`\n${'='.repeat(70)}`)
console.log(`  DEDUPE ${APPLY ? '»» AUSFÜHRUNG ««' : '(DRY-RUN — nichts wird geändert)'}`)
console.log('='.repeat(70))
for (const a of aktionen) {
  console.log(`\nVIN …${a.vin.slice(-8)}  (${a.keeper.marke} ${a.keeper.modell})`)
  console.log(`  ✔ KEEPER: ${(a.keeper.kennzeichen || '(kein KZ)').padEnd(12)} id=${a.keeper.id.slice(0, 8)} ` +
    `[Auftrag: ${a.keeperHatAuftrag ? 'ja' : 'NEIN → wird angelegt'}, Bilder: ${a.keeper.bilder_urls ? 'ja' : 'nein'}, B-Nr: ${a.keeper.mobile_de_id || '—'}]`)
  if (Object.keys(a.merge).length) console.log(`    ↳ Merge in Keeper: ${Object.keys(a.merge).join(', ')}`)
  for (const { d, auf } of a.loeschbar)
    console.log(`  ✖ löschen: ${(d.kennzeichen || '(kein KZ)').padEnd(12)} id=${d.id.slice(0, 8)} (Aufträge: ${auf.map(x => x.status).join(',') || 'keine'})`)
  for (const { d, auf } of a.zuPruefen)
    console.log(`  ⚠ MANUELL: ${(d.kennzeichen || '(kein KZ)').padEnd(12)} id=${d.id.slice(0, 8)} — Auftrag ${auf.map(x => x.status).join(',')} (nicht automatisch gelöscht)`)
}

console.log(`\n${'─'.repeat(70)}`)
console.log(`  Gruppen mit Duplikaten: ${aktionen.length}`)
console.log(`  Zu löschen:             ${planLoeschen} Fahrzeuge (+ deren 'angenommen'-Aufträge)`)
console.log(`  Keeper mit Merge:       ${planMerge}`)
console.log(`  Neue Aufträge:          ${planNeuerAuftrag} (Keeper ohne Auftrag)`)
console.log(`  Manuell zu prüfen:      ${manuell}`)
console.log(`  Fahrzeuge ohne VIN:     ${ohneVin.length} (nicht angefasst)`)
console.log('─'.repeat(70))

if (!APPLY) {
  console.log('\n→ Zum Ausführen:  node scripts/dedupe-fahrzeuge.mjs apply\n')
  process.exit(0)
}

// ── Ausführen ────────────────────────────────────────────────────
let del = 0, merged = 0, created = 0
for (const a of aktionen) {
  if (Object.keys(a.merge).length) {
    const { error } = await sb.from('fahrzeuge').update(a.merge).eq('id', a.keeper.id)
    if (!error) merged++
  }
  if (!a.keeperHatAuftrag) {
    const vinSuffix = (a.keeper.fahrgestellnummer || a.keeper.id).slice(-6).toUpperCase()
    const { error } = await sb.from('auftraege').insert({
      auftrag_nr: `AU-${vinSuffix}`, fahrzeug_id: a.keeper.id, kunden_id: null, status: 'angenommen',
    })
    if (!error) created++
  }
  for (const { d } of a.loeschbar) {
    await sb.from('auftraege').delete().eq('fahrzeug_id', d.id)
    const { error } = await sb.from('fahrzeuge').delete().eq('id', d.id)
    if (!error) del++
  }
}
console.log(`\n✅ Fertig: ${del} gelöscht · ${merged} Keeper ergänzt · ${created} Aufträge angelegt\n`)
