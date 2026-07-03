import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { DashboardContent } from './dashboard-content'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const monatStart = new Date()
  monatStart.setDate(1)
  monatStart.setHours(0, 0, 0, 0)
  const monatStartStr = monatStart.toISOString()
  const monatStartDate = monatStartStr.split('T')[0]

  const [
    { data: hebebuehnenRaw },
    { data: auftraegeRaw },
    { data: termineRaw },
    { count: eigenCount },
    { data: mitarbeiterRaw },
    { data: monatWerkstattRaw },
    { data: offeneRechnungenRaw },
    { data: bewertungenRaw },
  ] = await Promise.all([
    supabase.from('hebebuehnen').select('*').order('position').order('nummer'),
    supabase
      .from('auftraege')
      .select(`*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)`)
      .not('status', 'eq', 'ausgeliefert')
      .not('status', 'eq', 'storniert')
      .order('erstellt_am', { ascending: false }),
    supabase.from('termine').select('*, kunde:kunden(vorname,nachname), fahrzeug:fahrzeuge(kennzeichen,marke,modell)').gte('datum', new Date().toISOString().split('T')[0]).not('status', 'eq', 'abgesagt').order('datum').order('uhrzeit').limit(20),
    supabase.from('fahrzeuge').select('*', { count: 'exact', head: true }).eq('fahrzeug_typ', 'eigen'),
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
    supabase.from('auftraege').select('einnahmen, fertiggestellt_am, fahrzeug:fahrzeuge(fahrzeug_typ)').not('einnahmen', 'is', null).gte('fertiggestellt_am', monatStartDate),
    supabase.from('rechnungen').select('gesamt').eq('bezahlt', false),
    supabase.from('auftraege').select('bewertung_sterne, bewertung_kommentar, bewertung_datum, fahrzeug:fahrzeuge(marke, modell, kennzeichen), kunde:kunden(vorname, nachname)')
      .not('bewertung_sterne', 'is', null)
      .order('bewertung_datum', { ascending: false })
      .limit(10),
  ])

  const hebebuehnen = (hebebuehnenRaw ?? []) as any[]
  const auftraege = (auftraegeRaw ?? []).map((a: any) => ({
    ...a,
    hebebuehne: hebebuehnen.find(h => h.id === a.hebebuehne_id) ?? null,
  })) as any[]
  const alleTermine = (termineRaw ?? []) as any[]
  const naechsteTermine = alleTermine.slice(0, 5)
  // TÜV-Termine mit Bühnen-Reservierung (heute + nächste 7 Tage)
  const in7Tagen = new Date(); in7Tagen.setDate(in7Tagen.getDate() + 7)
  const tuevBuehnenTermine = alleTermine.filter((t: any) =>
    t.typ === 'tuev' && t.hebebuehne_id && new Date(t.datum) <= in7Tagen
  )
  const today = new Date().toISOString().split('T')[0]

  const offeneAuftraege = auftraege.filter((a: any) =>
    !['fertig', 'ausgeliefert'].includes(a.status)
  ).length

  const wartendeTeile = auftraege.reduce((sum: number, a: any) => {
    const teile = a.ersatzteile ?? []
    return sum + teile.filter((t: any) =>
      ['nicht_bestellt', 'bestellt', 'unterwegs'].includes(t.status)
    ).length
  }, 0)

  const fertigeHeute = auftraege.filter((a: any) =>
    a.status === 'fertig' && a.aktualisiert_am?.startsWith(today)
  ).length

  const ueberfaellig = auftraege.filter((a: any) =>
    a.geplante_fertigstellung &&
    a.geplante_fertigstellung < today &&
    !['fertig', 'ausgeliefert'].includes(a.status)
  ).length

  // Werkstatt-Umsatz diesen Monat: abgeschlossene Aufträge (ohne Eigenfahrzeug-Verkäufe)
  const monatsumsatz = (monatWerkstattRaw ?? [])
    .filter((a: any) => a.fahrzeug?.fahrzeug_typ !== 'eigen')
    .reduce((s: number, a: any) => s + (a.einnahmen ?? 0), 0)
  const offeneRechnungenSumme = (offeneRechnungenRaw ?? []).reduce((s: number, r: any) => s + (r.gesamt ?? 0), 0)
  const bewertungen = (bewertungenRaw ?? []) as any[]
  const bewertungDurchschnitt = bewertungen.length
    ? Math.round((bewertungen.reduce((s, b) => s + b.bewertung_sterne, 0) / bewertungen.length) * 10) / 10
    : null

  return (
    <AppLayout title="Hebebühnen">
      <DashboardContent
        hebebuehnen={hebebuehnen}
        auftraege={auftraege}
        offeneAuftraege={offeneAuftraege}
        wartendeTeile={wartendeTeile}
        fertigeHeute={fertigeHeute}
        ueberfaellig={ueberfaellig}
        naechsteTermine={naechsteTermine}
        eigenFahrzeuge={eigenCount ?? 0}
        tuevBuehnenTermine={tuevBuehnenTermine}
        mitarbeiter={(mitarbeiterRaw ?? []) as any[]}
        monatsumsatz={monatsumsatz}
        offeneRechnungenSumme={offeneRechnungenSumme}
        bewertungen={bewertungen}
        bewertungDurchschnitt={bewertungDurchschnitt}
      />
    </AppLayout>
  )
}
