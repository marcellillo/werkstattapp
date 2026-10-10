import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ServiceWeckerContent } from './service-wecker-content'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { ladeErinnerungen } from '@/lib/erinnerungen-server'
import { resolveFirmaSettings } from '@/lib/firma-settings'

export default async function ServiceWeckerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  // Alle Fremdfahrzeuge mit Kunde + letztem Auftrag
  const { data: fahrzeugeRaw } = await supabase
    .from('fahrzeuge')
    .select(`
      id, betrieb_id, kennzeichen, marke, modell, baujahr, kilometerstand,
      naechster_service_datum,
      kunden_id,
      kunde:kunden(id, vorname, nachname, telefon, mobil, email)
    `)
    .eq('betrieb_id', betriebId)
    .eq('fahrzeug_typ', 'fremd')
    .order('kennzeichen')

  // Letzter abgeschlossener Auftrag pro Fahrzeug
  const fahrzeugIds = (fahrzeugeRaw ?? []).map(f => f.id)
  const { data: letzteAuftraege } = fahrzeugIds.length > 0
    ? await supabase
        .from('auftraege')
        .select('id, fahrzeug_id, erstellt_am, status, arbeiten, einnahmen')
        .eq('betrieb_id', betriebId)
        .in('fahrzeug_id', fahrzeugIds)
        .in('status', ['fertig', 'ausgeliefert'])
        .order('erstellt_am', { ascending: false })
    : { data: [] }

  // Pro Fahrzeug nur den neuesten nehmen
  const letzterServiceMap: Record<string, any> = {}
  for (const a of letzteAuftraege ?? []) {
    if (!letzterServiceMap[a.fahrzeug_id]) {
      letzterServiceMap[a.fahrzeug_id] = a
    }
  }

  const fahrzeuge = (fahrzeugeRaw ?? []).map(f => ({
    ...f,
    letzter_service: letzterServiceMap[f.id] ?? null,
  }))

  const [erinnerungen, firma] = await Promise.all([
    ladeErinnerungen(supabase, betriebId, 'service'),
    resolveFirmaSettings(supabase, betriebId),
  ])

  return (
    <ServiceWeckerContent fahrzeuge={fahrzeuge as any[]} erinnerungen={erinnerungen} firmaName={firma.firma_name ?? ''} />
  )
}
