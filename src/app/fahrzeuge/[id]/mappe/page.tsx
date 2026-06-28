import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AuftragsMappe } from './auftrags-mappe'

export default async function MappePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: auftrag }, { data: fotos }, { data: rechnung }, { data: configRows }] = await Promise.all([
    supabase
      .from('auftraege')
      .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)')
      .eq('id', id)
      .single(),
    supabase.from('auftrag_fotos').select('*').eq('auftrag_id', id).order('erstellt_am'),
    supabase.from('kunden_rechnungen').select('*').eq('auftrag_id', id).maybeSingle(),
    supabase.from('werkstatt_einstellungen').select('schluessel, wert'),
  ])

  if (!auftrag) notFound()

  const cfg: Record<string, string> = {}
  for (const row of configRows ?? []) if (row.wert) cfg[row.schluessel] = row.wert

  return (
    <AuftragsMappe
      auftrag={auftrag as any}
      fotos={(fotos ?? []) as any[]}
      rechnung={rechnung as any}
      firma={cfg}
    />
  )
}
