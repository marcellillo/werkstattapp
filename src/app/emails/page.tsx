import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { EmailsContent } from './emails-content'

export default async function EmailsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: emails } = await supabase
    .from('email_protokoll')
    .select(`
      *,
      auftrag:auftraege(
        id, auftrag_nr,
        fahrzeug:fahrzeuge(marke, modell, kennzeichen)
      )
    `)
    .order('empfangen_am', { ascending: false })
    .limit(100)

  const { data: configRows } = await supabase
    .from('werkstatt_einstellungen')
    .select('schluessel, wert')

  const cfg: Record<string, string> = {}
  for (const row of configRows ?? []) {
    if (row.wert) cfg[row.schluessel] = row.wert
  }

  const istKonfiguriert = !!(cfg.ms_tenant_id && cfg.ms_client_id && cfg.ms_client_secret)

  return (
    <AppLayout title="E-Mail-Protokoll">
      <EmailsContent
        emails={(emails ?? []) as any[]}
        istKonfiguriert={istKonfiguriert}
        letzterSync={cfg.letzter_email_sync ?? null}
      />
    </AppLayout>
  )
}
