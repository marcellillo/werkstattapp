import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { TermineContent } from './termine-content'
import { getBetriebIdForUser } from '@/lib/server-betrieb'

export default async function TerminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const [{ data: termine }, { data: kunden }, { data: fahrzeuge }, { data: hebebuehnen }] = await Promise.all([
    supabase.from('termine').select('*, kunde:kunden(*), fahrzeug:fahrzeuge(*), hebebuehne:hebebuehnen(id,bezeichnung,nummer)').eq('betrieb_id', betriebId).order('datum').order('uhrzeit'),
    supabase.from('kunden').select('id, vorname, nachname, firma').eq('betrieb_id', betriebId).order('nachname'),
    supabase.from('fahrzeuge').select('id, marke, modell, kennzeichen').eq('betrieb_id', betriebId).order('kennzeichen'),
    supabase.from('hebebuehnen').select('id, bezeichnung, nummer').eq('betrieb_id', betriebId).order('nummer'),
  ])

  return (
    <AppLayout title="Termine">
      <TermineContent
        termine={(termine ?? []) as any[]}
        kunden={(kunden ?? []) as any[]}
        fahrzeuge={(fahrzeuge ?? []) as any[]}
        hebebuehnen={(hebebuehnen ?? []) as any[]}
      />
    </AppLayout>
  )
}
