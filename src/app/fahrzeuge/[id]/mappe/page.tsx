import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AuftragsMappe } from './auftrags-mappe'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { resolveFirmaSettings } from '@/lib/firma-settings'

export default async function MappePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const { data: auftrag } = await supabase
    .from('auftraege')
    .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)')
    .eq('betrieb_id', betriebId)
    .eq('id', id)
    .single()

  if (!auftrag) notFound()

  const [{ data: fotos }, { data: rechnung }, cfg, { data: dokumente }, { data: lieferantenRechnungen }] = await Promise.all([
    supabase.from('auftrag_fotos').select('*').eq('auftrag_id', id).order('erstellt_am'),
    supabase.from('kunden_rechnungen').select('*').eq('auftrag_id', id).maybeSingle(),
    resolveFirmaSettings(supabase, betriebId),
    supabase.from('lieferschein_uploads').select('*').eq('auftrag_id', id).order('erstellt_am'),
    auftrag.fahrzeug_id
      ? supabase.from('supplier_invoices').select('*').eq('fahrzeug_id', auftrag.fahrzeug_id).order('erstellt_am')
      : Promise.resolve({ data: [] as any[] }),
  ])

  return (
    <AuftragsMappe
      auftrag={auftrag as any}
      fotos={(fotos ?? []) as any[]}
      rechnung={rechnung as any}
      firma={cfg}
      dokumente={(dokumente ?? []) as any[]}
      lieferantenRechnungen={(lieferantenRechnungen ?? []) as any[]}
    />
  )
}
