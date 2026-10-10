import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FahrzeugeContent } from './fahrzeuge-content'
import { ladeErinnerungen } from '@/lib/erinnerungen-server'
import { resolveFirmaSettings } from '@/lib/firma-settings'

export default async function FahrzeugePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's betrieb
  const { data: userBetriebe } = await supabase
    .from('betrieb_users')
    .select('betrieb_id')
    .eq('profile_id', user.id)
    .order('is_primary', { ascending: false })
    .limit(1)

  if (!userBetriebe?.[0]?.betrieb_id) redirect('/login')
  const betriebId = userBetriebe[0].betrieb_id

  const [
    { data: auftraegeRaw },
    { data: hebebuehnenRaw },
    { data: tuevFahrzeugeRaw },
    { data: serviceFahrzeugeRaw },
    { data: tuevOhneHuRaw },
    tuevErinnerungen,
    serviceErinnerungen,
    firma,
  ] = await Promise.all([
    supabase
      .from('auftraege')
      .select(`*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)`)
      .eq('betrieb_id', betriebId)
      .neq('status', 'storniert')
      .order('erstellt_am', { ascending: false }),
    supabase.from('hebebuehnen').select('*').order('nummer'),
    supabase
      .from('fahrzeuge')
      .select('id, betrieb_id, kennzeichen, marke, modell, naechste_hauptuntersuchung, tuev_erinnerung, kunden_id, kunde:kunden(id, vorname, nachname, telefon, mobil, email)')
      .eq('betrieb_id', betriebId)
      .not('naechste_hauptuntersuchung', 'is', null)
      .neq('tuev_erinnerung', false)
      .order('naechste_hauptuntersuchung', { ascending: true }),
    supabase
      .from('fahrzeuge')
      .select('id, betrieb_id, kennzeichen, marke, modell, baujahr, kilometerstand, naechster_service_datum, kunden_id, kunde:kunden(id, vorname, nachname, telefon, mobil, email)')
      .eq('betrieb_id', betriebId)
      .eq('fahrzeug_typ', 'fremd')
      .order('kennzeichen'),
    supabase
      .from('fahrzeuge')
      .select('id, betrieb_id, kennzeichen, marke, modell, baujahr, kunden_id, kunde:kunden(id, vorname, nachname, telefon, mobil, email)')
      .eq('betrieb_id', betriebId)
      .is('naechste_hauptuntersuchung', null)
      .or('fahrzeug_typ.is.null,fahrzeug_typ.neq.eigen')
      .order('kennzeichen'),
    ladeErinnerungen(supabase, betriebId, 'hu'),
    ladeErinnerungen(supabase, betriebId, 'service'),
    resolveFirmaSettings(supabase, betriebId),
  ])

  const hebebuehnen = (hebebuehnenRaw ?? []) as any[]
  const auftraege = (auftraegeRaw ?? []).map((a: any) => ({
    ...a,
    hebebuehne: hebebuehnen.find(h => h.id === a.hebebuehne_id) ?? null,
  })) as any[]

  // Letzter abgeschlossener Auftrag pro Fahrzeug (für Service-Wecker) und die
  // Steuerart-Einstellung sind unabhängig voneinander -> parallel laden
  const serviceFahrzeugIds = (serviceFahrzeugeRaw ?? []).map((f: any) => f.id)
  const [{ data: letzteAuftraege }, { data: steuerCfg }] = await Promise.all([
    serviceFahrzeugIds.length > 0
      ? supabase
          .from('auftraege')
          .select('id, fahrzeug_id, erstellt_am, status, arbeiten')
          .in('fahrzeug_id', serviceFahrzeugIds)
          .in('status', ['fertig', 'ausgeliefert'])
          .order('erstellt_am', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from('betrieb_einstellungen').select('wert').eq('betrieb_id', betriebId).eq('schluessel', 'fahrzeug_steuerart_standard').maybeSingle(),
  ])
  const standardSteuerart = (steuerCfg?.wert as 'differenz' | 'regel' | 'ausfuhr') ?? 'differenz'

  const letzterServiceMap: Record<string, any> = {}
  for (const a of letzteAuftraege ?? []) {
    if (!letzterServiceMap[a.fahrzeug_id]) letzterServiceMap[a.fahrzeug_id] = a
  }

  const serviceFahrzeuge = (serviceFahrzeugeRaw ?? []).map((f: any) => ({
    ...f,
    letzter_service: letzterServiceMap[f.id] ?? null,
  }))

  return (
    <FahrzeugeContent
      auftraege={auftraege}
      tuevFahrzeuge={(tuevFahrzeugeRaw ?? []) as any[]}
      serviceFahrzeuge={serviceFahrzeuge as any[]}
      tuevOhneHu={(tuevOhneHuRaw ?? []) as any[]}
      tuevErinnerungen={tuevErinnerungen}
      serviceErinnerungen={serviceErinnerungen}
      firmaName={firma.firma_name ?? ''}
      standardSteuerart={standardSteuerart}
    />
  )
}
