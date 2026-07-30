import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ProtokolFlow } from './protokoll-flow'
import { getBetriebIdForUser } from '@/lib/server-betrieb'

export default async function ProtokolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const [
    { data: auftrag },
    { data: hebebuehnen },
    { data: rechnungen },
  ] = await Promise.all([
    supabase
      .from('auftraege')
      .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)')
      .eq('betrieb_id', betriebId)
      .eq('id', id)
      .single(),
    supabase.from('hebebuehnen').select('*'),
    supabase.from('rechnungen').select('*').eq('betrieb_id', betriebId).eq('auftrag_id', id).order('datum'),
  ])

  if (!auftrag) notFound()

  const resolved = {
    ...auftrag,
    hebebuehne: (hebebuehnen ?? []).find(h => h.id === (auftrag as any).hebebuehne_id) ?? null,
  }

  return <ProtokolFlow auftrag={resolved as any} rechnungen={rechnungen ?? []} />
}
