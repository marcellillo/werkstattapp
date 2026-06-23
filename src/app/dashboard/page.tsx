import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { DashboardContent } from './dashboard-content'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: hebebuehnenRaw },
    { data: auftraegeRaw },
    { data: termineRaw },
    { count: eigenCount },
  ] = await Promise.all([
    supabase.from('hebebuehnen').select('*').order('position').order('nummer'),
    supabase
      .from('auftraege')
      .select(`*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)`)
      .not('status', 'eq', 'ausgeliefert')
      .order('erstellt_am', { ascending: false }),
    supabase.from('termine').select('*, kunde:kunden(vorname,nachname), fahrzeug:fahrzeuge(kennzeichen,marke,modell)').gte('datum', new Date().toISOString().split('T')[0]).not('status', 'eq', 'abgesagt').order('datum').order('uhrzeit').limit(20),
    supabase.from('fahrzeuge').select('*', { count: 'exact', head: true }).eq('fahrzeug_typ', 'eigen'),
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
      />
    </AppLayout>
  )
}
