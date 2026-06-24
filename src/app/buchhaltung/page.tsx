import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { BuchhaltungContent } from './buchhaltung-content'

export default async function BuchhaltungPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Aufträge mit Einnahmen (Kundenrechnungen)
  const { data: auftraege } = await supabase
    .from('auftraege')
    .select('id, auftrag_nr, einnahmen, erstellt_am, status, fahrzeug:fahrzeuge(kennzeichen, marke, modell)')
    .not('einnahmen', 'is', null)
    .gt('einnahmen', 0)
    .order('erstellt_am', { ascending: false })

  // Lieferantenrechnungen (Ausgaben)
  const { data: ausgaben } = await supabase
    .from('rechnungen')
    .select('id, gesamt, datum, bezahlt, lieferant, rechnungsnummer, faellig_am')
    .order('datum', { ascending: false })

  // Einstellungen
  const { data: cfgRows } = await supabase
    .from('werkstatt_einstellungen')
    .select('schluessel, wert')
    .in('schluessel', ['firma_kleinunternehmer', 'firma_stundensatz', 'firma_name'])

  const cfg: Record<string, string> = {}
  for (const r of cfgRows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  return (
    <AppLayout title="Buchhaltung">
      <BuchhaltungContent
        auftraege={(auftraege ?? []) as any[]}
        ausgaben={(ausgaben ?? []) as any[]}
        kleinunternehmer={cfg.firma_kleinunternehmer === 'ja'}
        firmaName={cfg.firma_name ?? ''}
      />
    </AppLayout>
  )
}
