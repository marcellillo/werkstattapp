import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { KalenderContent } from './kalender-content'
import { getBetriebIdForUser } from '@/lib/server-betrieb'

export default async function KalenderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)
  const today = new Date().toISOString().split('T')[0]

  const [{ data: auftraegeRaw }, { data: termineRaw }, { data: kundenRaw }, { data: fahrzeugeRaw }] = await Promise.all([
    supabase
      .from('auftraege')
      .select(`
        id, auftrag_nr, status, geplante_fertigstellung, geschaetzte_dauer_tage, arbeiten,
        fahrzeug:fahrzeuge(marke, modell, kennzeichen),
        kunde:kunden(vorname, nachname),
        hebebuehne:hebebuehnen(bezeichnung)
      `)
      .eq('betrieb_id', betriebId)
      .not('status', 'eq', 'ausgeliefert')
      .not('status', 'eq', 'storniert')
      .not('status', 'eq', 'fertig')
      .order('geplante_fertigstellung', { ascending: true, nullsFirst: false }),
    supabase
      .from('termine')
      .select('id, titel, datum, uhrzeit, dauer_minuten, typ, status, beschreibung, fahrzeug:fahrzeuge(marke, modell, kennzeichen), kunde:kunden(vorname, nachname)')
      .eq('betrieb_id', betriebId)
      .neq('status', 'abgesagt')
      .gte('datum', today)
      .order('datum')
      .order('uhrzeit'),
    supabase
      .from('kunden')
      .select('id, vorname, nachname, telefon, email')
      .eq('betrieb_id', betriebId)
      .order('nachname'),
    supabase
      .from('fahrzeuge')
      .select('id, kennzeichen, marke, modell, kunde_id, naechste_hauptuntersuchung, tuev_erinnerung, naechster_service_datum')
      .eq('betrieb_id', betriebId)
      .order('kennzeichen'),
  ])

  return (
    <AppLayout title="Kalender">
      <KalenderContent
        auftraege={(auftraegeRaw ?? []) as any[]}
        termine={(termineRaw ?? []) as any[]}
        kunden={(kundenRaw ?? []) as any[]}
        fahrzeuge={(fahrzeugeRaw ?? []) as any[]}
      />
    </AppLayout>
  )
}
