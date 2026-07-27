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

  // Load or create default config
  const initialConfig = {
    imap_email: betrieb?.imap_email ?? '',
    imap_password: betrieb?.imap_password ?? '',
    graph_client_id: betrieb?.graph_client_id ?? '',
    graph_tenant_id: betrieb?.graph_tenant_id ?? '',
    graph_client_secret: betrieb?.graph_client_secret ?? '',
    graph_email: betrieb?.graph_email ?? '',
    graph_refresh_token: betrieb?.graph_refresh_token ?? '',
    anthropic_api_key: betrieb?.anthropic_api_key ?? '',
    resend_api_key: betrieb?.resend_api_key ?? '',
    firma_absender_email: betrieb?.firma_absender_email ?? '',
    firma_name: betrieb?.firma_name ?? '',
    firma_strasse: betrieb?.firma_strasse ?? '',
    firma_plz: betrieb?.firma_plz ?? '',
    firma_ort: betrieb?.firma_ort ?? '',
    firma_telefon: betrieb?.firma_telefon ?? '',
    firma_email: betrieb?.firma_email ?? '',
    firma_ust_id: betrieb?.firma_ust_id ?? '',
    firma_steuernummer: betrieb?.firma_steuernummer ?? '',
    firma_iban: betrieb?.firma_iban ?? '',
    firma_bic: betrieb?.firma_bic ?? '',
    firma_bank: betrieb?.firma_bank ?? '',
    firma_stundensatz: betrieb?.firma_stundensatz ?? '',
    firma_kleinunternehmer: betrieb?.firma_kleinunternehmer ?? '',
    firma_logo: betrieb?.firma_logo ?? '',
    firma_paypal: betrieb?.firma_paypal ?? '',
    firma_sumup: betrieb?.firma_sumup ?? '',
    firma_stripe: betrieb?.firma_stripe ?? '',
  }

  return (
    <AppLayout title="Einstellungen">
      <EinstellungenContent initialConfig={initialConfig} betriebName={betrieb?.name ?? 'Werkstatt'} />
    </AppLayout>
  )
}
