import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardContent } from './dashboard-content'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { istUeberfaellig } from '@/lib/zahlung'
import { hatKontakt } from '@/lib/kontakt'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const monatStart = new Date()
  monatStart.setDate(1)
  monatStart.setHours(0, 0, 0, 0)
  const monatStartStr = monatStart.toISOString()
  const monatStartDate = monatStartStr.split('T')[0]

  const [
    { data: hebebuehnenRaw },
    { data: auftraegeRaw },
    { data: termineRaw },
    { data: mitarbeiterRaw },
    { data: monatWerkstattRaw },
    { data: offeneRechnungenRaw },
    { data: kundenRechnungenOffenRaw },
    { data: kundenKontaktRaw },
    { count: fahrzeugeOhneHuAnzahl },
    { data: bewertungenRaw },
  ] = await Promise.all([
    supabase.from('hebebuehnen').select('*').order('position').order('nummer'),
    supabase
      .from('auftraege')
      .select(`*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)`)
      .eq('betrieb_id', betriebId)
      .not('status', 'eq', 'ausgeliefert')
      .not('status', 'eq', 'storniert')
      .order('erstellt_am', { ascending: false }),
    supabase.from('termine').select('*, kunde:kunden(vorname,nachname), fahrzeug:fahrzeuge(kennzeichen,marke,modell)').eq('betrieb_id', betriebId).gte('datum', new Date().toISOString().split('T')[0]).not('status', 'eq', 'abgesagt').order('datum').order('uhrzeit').limit(20),
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
    supabase.from('auftraege').select('einnahmen, fertiggestellt_am, fahrzeug:fahrzeuge(fahrzeug_typ)').eq('betrieb_id', betriebId).not('einnahmen', 'is', null).gte('fertiggestellt_am', monatStartDate),
    supabase.from('rechnungen').select('gesamt').eq('betrieb_id', betriebId).eq('bezahlt', false),
    // Kundenrechnungen (nur Finanzrollen sehen sie -- für alle anderen liefert die Datenbank nichts)
    supabase.from('kunden_rechnungen').select('betrag_brutto, faellig_am, erstellt_am, status').eq('betrieb_id', betriebId).eq('status', 'offen'),
    supabase.from('kunden').select('email, telefon, mobil').eq('betrieb_id', betriebId),
    supabase.from('fahrzeuge').select('id', { count: 'exact', head: true }).eq('betrieb_id', betriebId)
      .is('naechste_hauptuntersuchung', null).or('fahrzeug_typ.is.null,fahrzeug_typ.neq.eigen'),
    supabase.from('auftraege').select('bewertung_sterne, bewertung_kommentar, bewertung_datum, fahrzeug:fahrzeuge(marke, modell, kennzeichen), kunde:kunden(vorname, nachname)')
      .eq('betrieb_id', betriebId)
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

  // Kundenaufträge und Eigenfahrzeuge getrennt zählen: die Kacheln "Offene Aufträge/Heute fertig/Überfällig" meinen
  // Kundenfahrzeuge (Reiter "Aufträge"), "Lagerbestand" die Eigenfahrzeuge im Bestand (nicht verkauft/übergeben).
  const istEigen = (a: any) => a.fahrzeug?.fahrzeug_typ === 'eigen'
  const kundenAuftraege = auftraege.filter((a: any) => !istEigen(a))
  const lagerbestand = auftraege.filter((a: any) => istEigen(a) && a.status !== 'verkauft').length

  const offeneAuftraege = kundenAuftraege.filter((a: any) =>
    !['fertig', 'ausgeliefert'].includes(a.status)
  ).length

  const wartendeTeile = auftraege.reduce((sum: number, a: any) => {
    const teile = a.ersatzteile ?? []
    return sum + teile.filter((t: any) =>
      ['nicht_bestellt', 'bestellt', 'unterwegs'].includes(t.status)
    ).length
  }, 0)

  const fertigeHeute = kundenAuftraege.filter((a: any) =>
    a.status === 'fertig' && a.aktualisiert_am?.startsWith(today)
  ).length

  const ueberfaellig = kundenAuftraege.filter((a: any) =>
    a.geplante_fertigstellung &&
    a.geplante_fertigstellung < today &&
    !['fertig', 'ausgeliefert'].includes(a.status)
  ).length

  // Werkstatt-Umsatz diesen Monat: abgeschlossene Aufträge (ohne Eigenfahrzeug-Verkäufe)
  const monatsumsatz = (monatWerkstattRaw ?? [])
    .filter((a: any) => a.fahrzeug?.fahrzeug_typ !== 'eigen')
    .reduce((s: number, a: any) => s + (a.einnahmen ?? 0), 0)
  const offeneRechnungenSumme = (offeneRechnungenRaw ?? []).reduce((s: number, r: any) => s + (r.gesamt ?? 0), 0)
  const offeneKR = (kundenRechnungenOffenRaw ?? []) as any[]
  const ueberfaelligKR = offeneKR.filter(r => istUeberfaellig(r))
  const forderungen = {
    anzahl: offeneKR.length,
    summe: offeneKR.reduce((s, r) => s + (r.betrag_brutto ?? 0), 0),
    ueberfaellig: ueberfaelligKR.length,
    ueberfaelligSumme: ueberfaelligKR.reduce((s, r) => s + (r.betrag_brutto ?? 0), 0),
  }
  const luecken = {
    kundenOhneKontakt: ((kundenKontaktRaw ?? []) as any[]).filter(k => !hatKontakt(k.email, k.telefon, k.mobil)).length,
    fahrzeugeOhneHu: fahrzeugeOhneHuAnzahl ?? 0,
  }
  const bewertungen = (bewertungenRaw ?? []) as any[]
  const bewertungDurchschnitt = bewertungen.length
    ? Math.round((bewertungen.reduce((s, b) => s + b.bewertung_sterne, 0) / bewertungen.length) * 10) / 10
    : null

  return (
    <DashboardContent
      hebebuehnen={hebebuehnen}
      auftraege={auftraege}
      offeneAuftraege={offeneAuftraege}
      wartendeTeile={wartendeTeile}
      fertigeHeute={fertigeHeute}
      ueberfaellig={ueberfaellig}
      naechsteTermine={naechsteTermine}
      eigenFahrzeuge={lagerbestand}
      tuevBuehnenTermine={tuevBuehnenTermine}
      mitarbeiter={(mitarbeiterRaw ?? []) as any[]}
      monatsumsatz={monatsumsatz}
      offeneRechnungenSumme={offeneRechnungenSumme}
      forderungen={forderungen}
      luecken={luecken}
      bewertungen={bewertungen}
      bewertungDurchschnitt={bewertungDurchschnitt}
    />
  )
}
