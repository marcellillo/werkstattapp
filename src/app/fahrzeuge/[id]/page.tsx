import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { FahrzeugDetail } from './fahrzeug-detail'

export default async function FahrzeugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: auftrag, error: auftragError },
    { data: hebebuehnen },
    { data: historie },
    { data: cfgRow },
  ] = await Promise.all([
    supabase
      .from('auftraege')
      .select(`
        *,
        fahrzeug:fahrzeuge(*),
        kunde:kunden(*),
        ersatzteile(*)
      `)
      .eq('id', id)
      .single(),
    supabase.from('hebebuehnen').select('*').order('nummer'),
    supabase
      .from('status_historie')
      .select('*')
      .eq('auftrag_id', id)
      .order('erstellt_am', { ascending: false })
      .limit(20),
    supabase.from('werkstatt_einstellungen').select('wert').eq('schluessel', 'google_bewertung_url').maybeSingle(),
  ])

  if (auftragError) console.error('Auftrag query error:', JSON.stringify(auftragError))
  if (!auftrag) notFound()

  // Resolve hebebuehne from list since FK join may not be in schema cache
  const resolvedAuftrag = {
    ...auftrag,
    hebebuehne: (hebebuehnen ?? []).find(h => h.id === (auftrag as any).hebebuehne_id) ?? null,
  }

  const { data: steuerCfg } = await supabase
    .from('werkstatt_einstellungen').select('wert').eq('schluessel', 'fahrzeug_steuerart_standard').maybeSingle()
  const standardSteuerart = ((steuerCfg as any)?.wert as 'differenz' | 'regel' | 'ausfuhr') ?? 'differenz'

  return (
    <AppLayout title={`${(auftrag as any).fahrzeug?.marke} ${(auftrag as any).fahrzeug?.modell}`}>
      <FahrzeugDetail
        auftrag={resolvedAuftrag as any}
        hebebuehnen={(hebebuehnen ?? []) as any[]}
        historie={(historie ?? []) as any[]}
        googleBewertungUrl={(cfgRow as any)?.wert ?? ''}
        standardSteuerart={standardSteuerart}
      />
    </AppLayout>
  )
}
