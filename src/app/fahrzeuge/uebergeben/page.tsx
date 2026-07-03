import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { VerkauftContent } from '../verkauft/verkauft-content'

export default async function UebergebenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('auftraege')
    .select(`
      id, status, verkauft_am, auslieferung_geplant, einnahmen, bemerkungen, kaeufer_name, steuerart, erstellt_am,
      ersatzteile(einzelpreis, menge),
      fahrzeug:fahrzeuge(
        id, marke, modell, kennzeichen, mobile_de_id, fahrzeug_typ,
        baujahr, kilometerstand, farbe, motortyp, leistung_kw, bilder_urls,
        verkaufspreis, einkaufspreis
      )
    `)
    .eq('status', 'ausgeliefert')
    .order('verkauft_am', { ascending: false, nullsFirst: false })

  const verkauft = ((raw ?? []) as any[]).filter(
    a => (a.fahrzeug as any)?.fahrzeug_typ === 'eigen'
  )

  const { data: steuerCfg } = await supabase
    .from('werkstatt_einstellungen').select('wert').eq('schluessel', 'fahrzeug_steuerart_standard').maybeSingle()
  const standardSteuerart = (steuerCfg?.wert as 'differenz' | 'regel' | 'ausfuhr') ?? 'differenz'

  return (
    <AppLayout title="Verkaufshistorie">
      <VerkauftContent verkauft={verkauft} standardSteuerart={standardSteuerart} isArchiv={true} />
    </AppLayout>
  )
}
