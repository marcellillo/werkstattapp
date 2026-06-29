import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { BewertungForm } from './bewertung-form'

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function BewertungPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: auftrag }, { data: cfgRows }] = await Promise.all([
    supabase
      .from('auftraege')
      .select('id, auftrag_nr, bewertung_sterne, bewertung_datum, fahrzeug:fahrzeuge(marke, modell, kennzeichen), kunde:kunden(vorname, nachname)')
      .eq('id', id)
      .single(),
    supabase.from('werkstatt_einstellungen').select('schluessel, wert')
      .in('schluessel', ['firma_name', 'firma_telefon', 'firma_email']),
  ])

  if (!auftrag) notFound()

  const cfg: Record<string, string> = {}
  for (const r of cfgRows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  return <BewertungForm auftrag={auftrag as any} firma={cfg} />
}
