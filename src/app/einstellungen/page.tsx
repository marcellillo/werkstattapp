import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { EinstellungenContent } from './einstellungen-content'

export default async function EinstellungenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's betrieb
  const { data: userBetriebe } = await supabase
    .from('betrieb_users')
    .select('betrieb_id')
    .eq('profile_id', user.id)
    .order('is_primary', { ascending: false })
    .limit(1)

  if (!userBetriebe?.[0]?.betrieb_id) redirect('/login')
  const betriebId = userBetriebe[0].betrieb_id

  // Load betrieb data
  const { data: betrieb } = await supabase
    .from('betriebe')
    .select('*')
    .eq('id', betriebId)
    .single()

  // Load settings
  const { data: settings } = await supabase
    .from('betrieb_settings')
    .select('*')
    .eq('betrieb_id', betriebId)
    .single()

  // Build config with defaults
  const initialConfig = {
    imap_email: settings?.imap_email ?? '',
    imap_password: settings?.imap_password ?? '',
    graph_client_id: settings?.graph_client_id ?? '',
    graph_tenant_id: settings?.graph_tenant_id ?? '',
    graph_client_secret: settings?.graph_client_secret ?? '',
    graph_email: settings?.graph_email ?? '',
    graph_refresh_token: settings?.graph_refresh_token ?? '',
    anthropic_api_key: settings?.anthropic_api_key ?? '',
    resend_api_key: settings?.resend_api_key ?? '',
    firma_absender_email: settings?.firma_absender_email ?? '',
    firma_name: settings?.firma_name ?? '',
    firma_strasse: settings?.firma_strasse ?? '',
    firma_plz: settings?.firma_plz ?? '',
    firma_ort: settings?.firma_ort ?? '',
    firma_telefon: settings?.firma_telefon ?? '',
    firma_email: settings?.firma_email ?? '',
    firma_ust_id: settings?.firma_ust_id ?? '',
    firma_steuernummer: settings?.firma_steuernummer ?? '',
    firma_iban: settings?.firma_iban ?? '',
    firma_bic: settings?.firma_bic ?? '',
    firma_bank: settings?.firma_bank ?? '',
    firma_stundensatz: settings?.firma_stundensatz ?? '',
    firma_kleinunternehmer: settings?.firma_kleinunternehmer ?? '',
    firma_logo: settings?.firma_logo ?? '',
    firma_paypal: settings?.firma_paypal ?? '',
    firma_sumup: settings?.firma_sumup ?? '',
    firma_stripe: settings?.firma_stripe ?? '',
  }

  return (
    <AppLayout title="Einstellungen">
      <EinstellungenContent
        initialConfig={initialConfig}
        betriebName={betrieb?.name ?? 'Werkstatt'}
        betriebId={betriebId}
      />
    </AppLayout>
  )
}
