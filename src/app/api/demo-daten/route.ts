import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const now = new Date()
  const ts = (minusMin: number) => new Date(now.getTime() - minusMin * 60_000).toISOString()

  const beispiele = [
    {
      typ: 'termin_ueberschritten',
      titel: 'VW Golf (BO-KW 4521) überfällig',
      nachricht: 'Fertigstellung war geplant für ' + new Date(now.getTime() - 5 * 86_400_000).toLocaleDateString('de-DE') + ' — 5 Tage überschritten.',
      gelesen: false,
      benutzer_id: user.id,
      erstellt_am: ts(5),
    },
    {
      typ: 'termin_ueberschritten',
      titel: 'TÜV überfällig – BMW 3er (DO-AB 1234)',
      nachricht: 'TÜV-Termin war am ' + new Date(now.getTime() - 2 * 86_400_000).toLocaleDateString('de-DE') + ' und wurde überschritten.',
      gelesen: false,
      benutzer_id: user.id,
      erstellt_am: ts(30),
    },
    {
      typ: 'warnung',
      titel: 'TÜV in 3 Tagen – Audi A4 (RE-TZ 9876)',
      nachricht: 'Hauptuntersuchung am ' + new Date(now.getTime() + 3 * 86_400_000).toLocaleDateString('de-DE') + '. Bitte rechtzeitig vorbereiten.',
      gelesen: false,
      benutzer_id: user.id,
      erstellt_am: ts(60),
    },
    {
      typ: 'warnung',
      titel: 'Teil ausstehend: Bremsscheiben vorne',
      nachricht: '„Bremsscheiben vorne" (PV Automotive) wurde vor 6 Tagen bestellt (Status: Unterwegs).',
      gelesen: false,
      benutzer_id: user.id,
      erstellt_am: ts(90),
    },
    {
      typ: 'warnung',
      titel: 'Teil ausstehend: Ölfilter-Satz',
      nachricht: '„Ölfilter-Satz" (Nora) wurde vor 7 Tagen bestellt (Status: Bestellt).',
      gelesen: false,
      benutzer_id: user.id,
      erstellt_am: ts(120),
    },
    {
      typ: 'zu_lange_auf_buehne',
      titel: 'Ford Focus (UN-CD 5512) seit 4 Tagen auf Hebebühne',
      nachricht: 'Das Fahrzeug steht seit 4 Tagen auf der Hebebühne und blockiert den Stellplatz.',
      gelesen: false,
      benutzer_id: user.id,
      erstellt_am: ts(180),
    },
    {
      typ: 'info',
      titel: 'Termin heute: Kundengespräch Müller',
      nachricht: 'Heute um 14:00 Uhr – BMW 3er (DO-AB 1234).',
      gelesen: false,
      benutzer_id: user.id,
      erstellt_am: ts(10),
    },
    {
      typ: 'info',
      titel: 'Termin morgen: Reifenwechsel Schmidt',
      nachricht: 'Am ' + new Date(now.getTime() + 86_400_000).toLocaleDateString('de-DE') + ' um 09:00 Uhr – VW Golf.',
      gelesen: true,
      benutzer_id: user.id,
      erstellt_am: ts(240),
    },
    {
      typ: 'teil_eingetroffen',
      titel: 'Teil eingetroffen: Stoßdämpfer hinten',
      nachricht: '„Stoßdämpfer hinten links/rechts" von Bilstein ist geliefert worden und wartet auf Einbau.',
      gelesen: true,
      benutzer_id: user.id,
      erstellt_am: ts(300),
    },
    {
      typ: 'termin_ueberschritten',
      titel: 'Termin verpasst: Inspektion Weber',
      nachricht: 'Termin vom ' + new Date(now.getTime() - 86_400_000).toLocaleDateString('de-DE') + ' um 10:00 Uhr – Skoda Octavia wurde nicht als erledigt markiert.',
      gelesen: true,
      benutzer_id: user.id,
      erstellt_am: ts(400),
    },
  ]

  // Alte Demo-Daten erst löschen
  await supabase
    .from('benachrichtigungen')
    .delete()
    .eq('benutzer_id', user.id)
    .is('auftrag_id', null)

  const { error } = await supabase.from('benachrichtigungen').insert(beispiele)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ erstellt: beispiele.length })
}
