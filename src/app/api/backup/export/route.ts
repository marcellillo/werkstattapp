export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { ADMIN_ROLLEN, verlangeRolle } from '@/lib/rollen-server'
import { rateLimit } from '@/lib/rate-limit'
import { serverFehler } from '@/lib/api-fehler'
import { istGeheimerSchluessel } from '@/lib/betrieb-geheimnisse'
import { zipErstellen, type ZipEintrag } from '@/lib/zip'
import { exportAblegen } from '@/lib/export-ablage'
import { deDatum } from '@/lib/csv'
import { tagBerlin } from '@/lib/zahlung'

// Tabellen mit Betriebsdaten, die in die Sicherung gehören. Bewusst NICHT enthalten: Zugangsdaten/Tokens
// (betrieb_geheimnisse, kva_freigabe_tokens, user_invitations), Abrechnung (betrieb_subscription, betrieb_payment_events)
// und E-Mail-Protokolle.
const TABELLEN = [
  'kunden', 'fahrzeuge', 'auftraege', 'termine', 'hebebuehnen',
  'kostenvoranschlaege', 'kostenvoranschlag_position', 'werkstattauftraege', 'werkstattauftrag_positionen',
  'kunden_rechnungen', 'rechnung_betriebsstoffe', 'fahrzeug_rechnungen', 'rechnungen', 'supplier_invoices',
  'ersatzteile', 'lager_artikel', 'betriebsstoffe', 'betriebsstoff_zugaenge', 'auftrag_betriebsstoffe',
  'leistungspakete', 'leistungspaket_positionen', 'leistungspaket_betriebsstoffe',
  'auftrag_dokumente', 'auftrag_fotos', 'auftrag_lieferscheine', 'lieferschein_uploads',
  'status_historie', 'kunden_erinnerungen', 'maintenance_specs', 'betrieb_users', 'betrieb_einstellungen',
] as const
const SEITE = 1000
const MAX_ZEILEN = 50_000

// POST /api/backup/export — alle Daten dieses Betriebs als ZIP mit einer JSON-Datei je Tabelle. Nur Administratoren.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const betriebId = await getBetriebIdForUser(supabase, user.id).catch(() => null)
  if (!betriebId) return NextResponse.json({ error: 'Kein Betrieb gefunden' }, { status: 404 })
  const verboten = await verlangeRolle(supabase, user.id, betriebId, ADMIN_ROLLEN, 'Die Datensicherung dürfen nur Administratoren herunterladen.')
  if (verboten) return verboten
  const limit = await rateLimit(`backup-export:${user.id}`, 5, 600)
  if (limit) return limit

  try {
    const admin = createAdminClient()
    const dateien: ZipEintrag[] = []
    const uebersicht: { name: string; anzahl: number }[] = []
    const hinweise: string[] = []

    for (const tabelle of TABELLEN) {
      let zeilen: any[] = []
      let fehler: string | null = null
      for (let seite = 0; seite * SEITE < MAX_ZEILEN; seite++) {
        const { data, error } = await admin.from(tabelle).select('*').eq('betrieb_id', betriebId).range(seite * SEITE, seite * SEITE + SEITE - 1)
        if (error) { fehler = error.message; break }
        zeilen.push(...(data ?? []))
        if ((data ?? []).length < SEITE) break
      }
      if (fehler) { hinweise.push(`Tabelle „${tabelle}“ konnte nicht gesichert werden.`); console.error('[backup]', tabelle, fehler); continue }
      if (tabelle === 'betrieb_einstellungen') zeilen = zeilen.filter(z => !istGeheimerSchluessel(z.schluessel) && !/^graph_/.test(z.schluessel))
      dateien.push({ name: `daten/${tabelle}.json`, daten: JSON.stringify(zeilen, null, 1) })
      uebersicht.push({ name: tabelle, anzahl: zeilen.length })
    }

    // Namen der Mitarbeiter (nur Name/E-Mail/Rolle) -- für das Lesen der Sicherung
    const { data: team } = await admin.from('betrieb_users').select('profile_id, role').eq('betrieb_id', betriebId)
    const { data: profile } = await admin.from('profiles').select('id, full_name, email').in('id', (team ?? []).map((t: any) => t.profile_id))
    dateien.push({ name: 'daten/mitarbeiter.json', daten: JSON.stringify((team ?? []).map((t: any) => ({ ...t, ...((profile ?? []).find((p: any) => p.id === t.profile_id) ?? {}) })), null, 1) })

    const { data: betrieb } = await admin.from('betriebe').select('*').eq('id', betriebId).maybeSingle()
    dateien.push({ name: 'daten/betrieb.json', daten: JSON.stringify(betrieb ?? {}, null, 1) })

    dateien.unshift({
      name: 'LIESMICH.txt',
      daten: [
        `Datensicherung vom ${deDatum(tagBerlin())}`, '',
        'Inhalt: alle Daten Ihres Betriebs aus der Datenbank, je Tabelle eine JSON-Datei im Ordner "daten"',
        '(Kunden, Fahrzeuge, Auftraege, Termine, Rechnungen, Kostenvoranschlaege, Betriebsstoffe, Leistungspakete ...).', '',
        'NICHT enthalten:',
        '  - Dateien: Fotos, PDFs, Fahrzeugscheine, Lieferscheine und Eingangsbelege liegen im Datei-Speicher (die JSON-Dateien',
        '    enthalten nur deren Pfade).',
        '  - Zugangsdaten (Passwoerter, Schluessel, Tokens) - aus Sicherheitsgruenden.', '',
        'Bewahren Sie diese Datei sicher auf: sie enthaelt Kunden- und Finanzdaten.',
        'Lesen: JSON-Dateien lassen sich mit jedem Texteditor oder per Excel (Daten > Aus JSON) oeffnen.',
        'Eine Wiederherstellung erfolgt durch den Entwickler.', '',
        'Anzahl Datensaetze je Tabelle:',
        ...uebersicht.map(u => `  ${u.name}: ${u.anzahl}`),
        ...(hinweise.length ? ['', 'Hinweise:', ...hinweise.map(h => '  ' + h)] : []),
      ].join('\r\n') + '\r\n',
    })

    const zip = zipErstellen(dateien)
    const dateiname = `Datensicherung_${tagBerlin()}.zip`
    const { downloadUrl } = await exportAblegen(betriebId, dateiname, zip)
    // Zeitpunkt merken (die Startseite erinnert, wenn die letzte Sicherung lange her ist)
    await admin.from('betrieb_einstellungen').upsert({ betrieb_id: betriebId, schluessel: 'letzte_sicherung', wert: new Date().toISOString() }, { onConflict: 'betrieb_id,schluessel' })

    return NextResponse.json({ downloadUrl, dateiname, groesse: zip.length, tabellen: uebersicht, hinweise })
  } catch (e) {
    return serverFehler(e, 'backup/export')
  }
}
