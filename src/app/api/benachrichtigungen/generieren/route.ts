import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEDUPE_STUNDEN = 12 // Keine doppelten Notifications innerhalb von 12h

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const heute = new Date()
  const heuteStr = heute.toISOString().split('T')[0]
  const dedupeGrenze = new Date(heute.getTime() - DEDUPE_STUNDEN * 3_600_000).toISOString()

  // Bereits vorhandene Notifications der letzten 12h laden (für Deduplizierung)
  const { data: vorhanden } = await supabase
    .from('benachrichtigungen')
    .select('typ, auftrag_id, titel')
    .gte('erstellt_am', dedupeGrenze)

  const vorhKey = new Set((vorhanden ?? []).map(n => `${n.typ}::${n.auftrag_id ?? ''}::${n.titel}`))
  const neu: any[] = []

  function addNeu(n: { typ: string; titel: string; nachricht: string; auftrag_id?: string }) {
    const key = `${n.typ}::${n.auftrag_id ?? ''}::${n.titel}`
    if (!vorhKey.has(key)) {
      vorhKey.add(key)
      neu.push({ ...n, gelesen: false, benutzer_id: null })
    }
  }

  // ── 1. Überfällige Aufträge ──────────────────────────────────────────────
  const { data: auftraege } = await supabase
    .from('auftraege')
    .select('id, auftrag_nr, geplante_fertigstellung, tuev_kandidat, tuev_termin, status, erstellt_am, hebebuehne_id, fahrzeug:fahrzeuge(marke, modell, kennzeichen)')
    .not('status', 'in', '("fertig","ausgeliefert")')

  for (const a of auftraege ?? []) {
    const fz = (a as any).fahrzeug
    const name = fz ? `${fz.marke} ${fz.modell} (${fz.kennzeichen})` : `Auftrag ${(a as any).auftrag_nr}`

    // Überfällig
    if ((a as any).geplante_fertigstellung && (a as any).geplante_fertigstellung < heuteStr) {
      const tage = Math.floor((heute.getTime() - new Date((a as any).geplante_fertigstellung).getTime()) / 86_400_000)
      addNeu({
        typ: 'termin_ueberschritten',
        auftrag_id: a.id,
        titel: `${name} überfällig`,
        nachricht: `Fertigstellung war geplant für ${new Date((a as any).geplante_fertigstellung).toLocaleDateString('de-DE')} — ${tage} Tag${tage !== 1 ? 'e' : ''} überschritten.`,
      })
    }

    // TÜV-Termin nahe oder überschritten
    if ((a as any).tuev_kandidat && (a as any).tuev_termin) {
      const tuevDate = new Date((a as any).tuev_termin)
      const tageBis = Math.floor((tuevDate.getTime() - heute.getTime()) / 86_400_000)
      if (tageBis < 0) {
        addNeu({
          typ: 'termin_ueberschritten',
          auftrag_id: a.id,
          titel: `TÜV überfällig – ${name}`,
          nachricht: `TÜV-Termin war am ${tuevDate.toLocaleDateString('de-DE')} und wurde überschritten.`,
        })
      } else if (tageBis <= 7) {
        addNeu({
          typ: 'warnung',
          auftrag_id: a.id,
          titel: `TÜV in ${tageBis} Tag${tageBis !== 1 ? 'en' : ''} – ${name}`,
          nachricht: `Hauptuntersuchung am ${tuevDate.toLocaleDateString('de-DE')}. Bitte rechtzeitig vorbereiten.`,
        })
      }
    }

    // Zu lange auf Hebebühne (> 3 Tage)
    if ((a as any).hebebuehne_id && (a as any).erstellt_am) {
      const tage = Math.floor((heute.getTime() - new Date((a as any).erstellt_am).getTime()) / 86_400_000)
      if (tage > 3) {
        addNeu({
          typ: 'zu_lange_auf_buehne',
          auftrag_id: a.id,
          titel: `${name} seit ${tage} Tagen auf Hebebühne`,
          nachricht: `Das Fahrzeug steht seit ${tage} Tagen auf der Hebebühne und blockiert den Stellplatz.`,
        })
      }
    }
  }

  // ── 2. Ersatzteile – lange ausstehend ────────────────────────────────────
  const { data: teile } = await supabase
    .from('ersatzteile')
    .select('id, bezeichnung, lieferant, bestellt_am, status, auftrag_id')
    .in('status', ['bestellt', 'unterwegs'])

  for (const t of teile ?? []) {
    if (!(t as any).bestellt_am) continue
    const tage = Math.floor((heute.getTime() - new Date((t as any).bestellt_am).getTime()) / 86_400_000)
    if (tage >= 5) {
      const lieferant = (t as any).lieferant ? ` (${(t as any).lieferant})` : ''
      addNeu({
        typ: 'warnung',
        auftrag_id: (t as any).auftrag_id ?? undefined,
        titel: `Teil ausstehend: ${(t as any).bezeichnung}`,
        nachricht: `„${(t as any).bezeichnung}"${lieferant} wurde vor ${tage} Tagen bestellt (Status: ${(t as any).status === 'bestellt' ? 'Bestellt' : 'Unterwegs'}).`,
      })
    }
  }

  // ── 3. Termine ───────────────────────────────────────────────────────────
  const morgen = new Date(heute)
  morgen.setDate(morgen.getDate() + 1)
  const uebermorgen = new Date(heute)
  uebermorgen.setDate(uebermorgen.getDate() + 3)

  const { data: termine } = await supabase
    .from('termine')
    .select('id, titel, datum, uhrzeit, typ, status, auftrag_id, fahrzeug:fahrzeuge(marke, modell, kennzeichen), kunde:kunden(vorname, nachname)')
    .not('status', 'in', '("erledigt","abgesagt")')
    .lte('datum', uebermorgen.toISOString().split('T')[0])

  for (const t of termine ?? []) {
    const terminDatum = new Date((t as any).datum)
    const tageBis = Math.floor((terminDatum.getTime() - heute.setHours(0,0,0,0)) / 86_400_000)
    heute.setHours(0,0,0,0) // reset nach setHours

    const fz = (t as any).fahrzeug
    const kd = (t as any).kunde
    const bezug = fz ? `${fz.marke} ${fz.modell}` : kd ? `${kd.vorname} ${kd.nachname}` : ''
    const uhrzeitStr = (t as any).uhrzeit ? ` um ${(t as any).uhrzeit.slice(0,5)} Uhr` : ''

    if (tageBis < 0) {
      addNeu({
        typ: 'termin_ueberschritten',
        auftrag_id: (t as any).auftrag_id ?? undefined,
        titel: `Termin verpasst: ${(t as any).titel}`,
        nachricht: `Termin vom ${terminDatum.toLocaleDateString('de-DE')}${uhrzeitStr}${bezug ? ` – ${bezug}` : ''} wurde nicht als erledigt markiert.`,
      })
    } else if (tageBis === 0) {
      addNeu({
        typ: 'info',
        auftrag_id: (t as any).auftrag_id ?? undefined,
        titel: `Termin heute: ${(t as any).titel}`,
        nachricht: `Heute${uhrzeitStr}${bezug ? ` – ${bezug}` : ''}.`,
      })
    } else if (tageBis <= 2) {
      addNeu({
        typ: 'info',
        auftrag_id: (t as any).auftrag_id ?? undefined,
        titel: `Termin in ${tageBis} Tag${tageBis > 1 ? 'en' : ''}: ${(t as any).titel}`,
        nachricht: `Am ${terminDatum.toLocaleDateString('de-DE')}${uhrzeitStr}${bezug ? ` – ${bezug}` : ''}.`,
      })
    }
  }

  // ── Einfügen ─────────────────────────────────────────────────────────────
  if (neu.length > 0) {
    await supabase.from('benachrichtigungen').insert(neu)
  }

  return NextResponse.json({ erstellt: neu.length })
}
