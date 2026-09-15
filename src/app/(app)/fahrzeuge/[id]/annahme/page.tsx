import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AnnahmeProtokoll } from './annahme-protokoll'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { resolveFirmaSettings } from '@/lib/firma-settings'

export default async function AnnahmePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const [{ data: auftrag }, cfg] = await Promise.all([
    supabase
      .from('auftraege')
      .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(*)')
      .eq('betrieb_id', betriebId)
      .eq('id', id)
      .single(),
    resolveFirmaSettings(supabase, betriebId),
  ])

  if (!auftrag) notFound()

  return <AnnahmeProtokoll auftrag={auftrag as any} firma={cfg} />
}
