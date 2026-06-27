import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AnnahmeProtokoll } from './annahme-protokoll'

export default async function AnnahmePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: auftrag }, { data: configRows }] = await Promise.all([
    supabase
      .from('auftraege')
      .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(*)')
      .eq('id', id)
      .single(),
    supabase.from('werkstatt_einstellungen').select('schluessel, wert'),
  ])

  if (!auftrag) notFound()

  const cfg: Record<string, string> = {}
  for (const row of configRows ?? []) {
    if (row.wert) cfg[row.schluessel] = row.wert
  }

  return <AnnahmeProtokoll auftrag={auftrag as any} firma={cfg} />
}
