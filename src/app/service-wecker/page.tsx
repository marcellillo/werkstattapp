import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { ServiceWeckerContent } from './service-wecker-content'

export default async function ServiceWeckerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Alle Fremdfahrzeuge mit Kunde + letztem Auftrag
  const { data: fahrzeugeRaw } = await supabase
    .from('fahrzeuge')
    .select(`
      id, kennzeichen, marke, modell, baujahr, kilometerstand,
      naechster_service_datum,
      kunde_id,
      kunde:kunden(id, vorname, nachname, telefon, email)
    `)
    .eq('fahrzeug_typ', 'fremd')
    .order('kennzeichen')

  // Letzter abgeschlossener Auftrag pro Fahrzeug
  const fahrzeugIds = (fahrzeugeRaw ?? []).map(f => f.id)
  const { data: letzteAuftraege } = fahrzeugIds.length > 0
    ? await supabase
        .from('auftraege')
        .select('id, fahrzeug_id, erstellt_am, status, arbeiten, einnahmen')
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

  return (
    <AppLayout title="Service-Wecker">
      <ServiceWeckerContent fahrzeuge={fahrzeuge as any[]} />
    </AppLayout>
  )
}
