import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { RechnungFlow } from './rechnung-flow'

export default async function RechnungPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: auftrag }, { data: configRows }] = await Promise.all([
    supabase
      .from('auftraege')
      .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)')
      .eq('id', id)
      .single(),
    supabase.from('werkstatt_einstellungen').select('schluessel, wert'),
  ])

  if (!auftrag) notFound()

  const cfg: Record<string, string> = {}
  for (const row of configRows ?? []) {
    if (row.wert) cfg[row.schluessel] = row.wert
  }

  return <RechnungFlow auftrag={auftrag as any} firma={cfg} />
}
