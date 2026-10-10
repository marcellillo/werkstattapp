import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EinstellungenContent } from './einstellungen-content'
import { hatGeheimnisse, istGeheimerSchluessel } from '@/lib/betrieb-geheimnisse'

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

  // Betrieb-Stammdaten und Einstellungen sind unabhängig voneinander -> parallel laden
  const [{ data: betrieb }, { data: settingsRows }] = await Promise.all([
    supabase
      .from('betriebe')
      .select('*')
      .eq('id', betriebId)
      .single(),
    // Load settings (Key-Value-Tabelle: eine Zeile pro schluessel/wert)
    supabase
      .from('betrieb_einstellungen')
      .select('schluessel, wert')
      .eq('betrieb_id', betriebId),
  ])

  const settings: Record<string, string> = {}
  for (const row of settingsRows ?? []) {
    if (row.wert !== null && !istGeheimerSchluessel(row.schluessel)) settings[row.schluessel] = row.wert
  }
  // Zugangsdaten werden nie an den Browser geschickt -- nur, OB sie gesetzt sind
  const geheim = await hatGeheimnisse(betriebId, ['anthropic_api_key', 'resend_api_key', 'graph_client_secret', 'graph_refresh_token'])

  // Build config with defaults
  const initialConfig = {
    imap_email: settings?.imap_email ?? '',
    imap_password: '',
    graph_client_id: settings?.graph_client_id ?? '',
    graph_tenant_id: settings?.graph_tenant_id ?? '',
    graph_client_secret: '', // nie an den Browser ausliefern
    graph_email: settings?.graph_email ?? '',
    graph_refresh_token: '', // nie an den Browser ausliefern
    anthropic_api_key: '',
    resend_api_key: '',
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
    firma_geschaeftsfuehrer: settings?.firma_geschaeftsfuehrer ?? '',
    firma_hrb: settings?.firma_hrb ?? '',
    firma_amtsgericht: settings?.firma_amtsgericht ?? '',
    firma_stundensatz: settings?.firma_stundensatz ?? '',
    google_bewertung_url: settings?.google_bewertung_url ?? '',
    zahlungsziel_tage: settings?.zahlungsziel_tage ?? '',
    firma_kleinunternehmer: settings?.firma_kleinunternehmer ?? '',
    firma_logo: settings?.firma_logo ?? '',
    firma_paypal: settings?.firma_paypal ?? '',
    firma_sumup: settings?.firma_sumup ?? '',
    firma_stripe: settings?.firma_stripe ?? '',
  }

  return (
    <EinstellungenContent
      initialConfig={initialConfig}
      geheimnisseGesetzt={{ anthropic_api_key: geheim.anthropic_api_key, resend_api_key: geheim.resend_api_key }}
      graphStatus={{
        clientId: settings.graph_client_id ?? '',
        tenantId: settings.graph_tenant_id ?? '',
        hatSecret: geheim.graph_client_secret,
        verbunden: geheim.graph_refresh_token,
        email: settings.graph_email ?? '',
        aktiv: settings.email_sync_aktiv === 'true',
        letzterSync: settings.letzter_email_sync ?? null,
        fehler: settings.graph_fehler ?? '',
      }}
      betriebName={betrieb?.name ?? 'Werkstatt'}
      betriebId={betriebId}
    />
  )
}
