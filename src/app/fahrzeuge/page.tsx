import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { FahrzeugeContent } from './fahrzeuge-content'

export default async function FahrzeugePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: auftraegeRaw },
    { data: hebebuehnenRaw },
    { data: tuevFahrzeugeRaw },
    { data: serviceFahrzeugeRaw },
  ] = await Promise.all([
    supabase
      .from('auftraege')
      .select(`*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)`)
      .neq('status', 'storniert')
      .order('erstellt_am', { ascending: false }),
    supabase.from('hebebuehnen').select('*').order('nummer'),
    supabase
      .from('fahrzeuge')
      .select('id, kennzeichen, marke, modell, naechste_hauptuntersuchung, tuev_erinnerung, kunde_id, kunde:kunden(id, vorname, nachname, telefon, email)')
      .not('naechste_hauptuntersuchung', 'is', null)
      .neq('tuev_erinnerung', false)
      .order('naechste_hauptuntersuchung', { ascending: true }),
    supabase
      .from('fahrzeuge')
      .select('id, kennzeichen, marke, modell, baujahr, kilometerstand, naechster_service_datum, kunde_id, kunde:kunden(id, vorname, nachname, telefon, email)')
      .eq('fahrzeug_typ', 'fremd')
      .order('kennzeichen'),
  ])

  const hebebuehnen = (hebebuehnenRaw ?? []) as any[]
  const auftraege = (auftraegeRaw ?? []).map((a: any) => ({
    ...a,
    hebebuehne: hebebuehnen.find(h => h.id === a.hebebuehne_id) ?? null,
  })) as any[]

  // Letzter abgeschlossener Auftrag pro Fahrzeug für Service-Wecker
  const serviceFahrzeugIds = (serviceFahrzeugeRaw ?? []).map((f: any) => f.id)
  const { data: letzteAuftraege } = serviceFahrzeugIds.length > 0
    ? await supabase
        .from('auftraege')
        .select('id, fahrzeug_id, erstellt_am, status, arbeiten')
        .in('fahrzeug_id', serviceFahrzeugIds)
        .in('status', ['fertig', 'ausgeliefert'])
        .order('erstellt_am', { ascending: false })
    : { data: [] }

  const letzterServiceMap: Record<string, any> = {}
  for (const a of letzteAuftraege ?? []) {
    if (!letzterServiceMap[a.fahrzeug_id]) letzterServiceMap[a.fahrzeug_id] = a
  }

  const serviceFahrzeuge = (serviceFahrzeugeRaw ?? []).map((f: any) => ({
    ...f,
    letzter_service: letzterServiceMap[f.id] ?? null,
  }))

  const { data: steuerCfg } = await supabase
    .from('werkstatt_einstellungen').select('wert').eq('schluessel', 'fahrzeug_steuerart_standard').maybeSingle()
  const standardSteuerart = (steuerCfg?.wert as 'differenz' | 'regel' | 'ausfuhr') ?? 'differenz'

  return (
    <AppLayout title="Fahrzeuge">
      <FahrzeugeContent
        auftraege={auftraege}
        tuevFahrzeuge={(tuevFahrzeugeRaw ?? []) as any[]}
        serviceFahrzeuge={serviceFahrzeuge as any[]}
        standardSteuerart={standardSteuerart}
      />
    </AppLayout>
  )
}
