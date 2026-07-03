/**
 * Backfill nach werkstatt-update-v8.sql:
 * - fahrzeuge.verkaufspreis  ← aus notizen "Verkaufspreis: X € (Brutto)"
 * - auftraege.kaeufer_name    ← aus bemerkungen "Käufer: X"
 * Idempotent: überspringt Zeilen, deren Zielspalte bereits gefüllt ist.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(join(root, '.env.local'), 'utf8')
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim()
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'))

// ── Verkaufspreis ────────────────────────────────────────────────
const { data: fahrzeuge } = await sb
  .from('fahrzeuge')
  .select('id, notizen, verkaufspreis')
  .not('notizen', 'is', null)

let preisGesetzt = 0
for (const f of fahrzeuge ?? []) {
  if (f.verkaufspreis != null) continue
  const m = f.notizen?.match(/Verkaufspreis:\s*([\d.]+)(?:,(\d{2}))?\s*€/)
  if (!m) continue
  // "24.990,00" → 24990.00
  const preis = parseFloat(m[1].replace(/\./g, '') + (m[2] ? '.' + m[2] : ''))
  if (isNaN(preis) || preis <= 0) continue
  const { error } = await sb.from('fahrzeuge').update({ verkaufspreis: preis }).eq('id', f.id)
  if (!error) preisGesetzt++
}

// ── Käufer-Name ──────────────────────────────────────────────────
const { data: auftraege } = await sb
  .from('auftraege')
  .select('id, bemerkungen, kaeufer_name')
  .not('bemerkungen', 'is', null)

let kaeuferGesetzt = 0
for (const a of auftraege ?? []) {
  if (a.kaeufer_name) continue
  const m = a.bemerkungen?.match(/Käufer:\s*(.+)/)
  if (!m) continue
  const name = m[1].trim()
  if (!name) continue
  const { error } = await sb.from('auftraege').update({ kaeufer_name: name }).eq('id', a.id)
  if (!error) kaeuferGesetzt++
}

console.log(`\n✅ Backfill fertig: ${preisGesetzt} Verkaufspreise · ${kaeuferGesetzt} Käufer-Namen übertragen\n`)
