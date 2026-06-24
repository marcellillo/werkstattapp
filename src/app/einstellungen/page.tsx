import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { EinstellungenContent } from './einstellungen-content'

export default async function EinstellungenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: configRows } = await supabase
    .from('werkstatt_einstellungen')
    .select('schluessel, wert')

  const cfg: Record<string, string> = {}
  for (const row of configRows ?? []) {
    if (row.wert) cfg[row.schluessel] = row.wert
  }

  return (
    <AppLayout title="Einstellungen">
      <EinstellungenContent
        profile={profile}
        userEmail={user.email ?? ''}
        initialConfig={{
          imap_email: cfg.imap_email ?? '',
          imap_password: cfg.imap_password ?? '',
          graph_client_id: cfg.graph_client_id ?? '',
          graph_tenant_id: cfg.graph_tenant_id ?? '',
          graph_client_secret: cfg.graph_client_secret ?? '',
          graph_email: cfg.graph_email ?? '',
          graph_refresh_token: cfg.graph_refresh_token ?? '',
          anthropic_api_key: cfg.anthropic_api_key ?? '',
          firma_name: cfg.firma_name ?? '',
          firma_strasse: cfg.firma_strasse ?? '',
          firma_plz: cfg.firma_plz ?? '',
          firma_ort: cfg.firma_ort ?? '',
          firma_telefon: cfg.firma_telefon ?? '',
          firma_email: cfg.firma_email ?? '',
          firma_ust_id: cfg.firma_ust_id ?? '',
          firma_steuernummer: cfg.firma_steuernummer ?? '',
          firma_iban: cfg.firma_iban ?? '',
          firma_bic: cfg.firma_bic ?? '',
          firma_bank: cfg.firma_bank ?? '',
          firma_stundensatz: cfg.firma_stundensatz ?? '',
          firma_kleinunternehmer: cfg.firma_kleinunternehmer ?? 'nein',
          firma_logo: cfg.firma_logo ?? '',
        }}
      />
    </AppLayout>
  )
}
