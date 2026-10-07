import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RechnungenContent } from './rechnungen-content'
import { hatGeheimnisse } from '@/lib/betrieb-geheimnisse'

export default async function RechnungenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userBetriebe } = await supabase
    .from('betrieb_users')
    .select('betrieb_id, role')
    .eq('profile_id', user.id)
    .order('is_primary', { ascending: false })
    .limit(1)

  if (!userBetriebe?.[0]?.betrieb_id) redirect('/login')
  const betriebId = userBetriebe[0].betrieb_id
  const rolle = userBetriebe[0].role
  const isAdmin = rolle === 'admin' || rolle === 'superadmin'

  const [rechnungen, einstellungen] = await Promise.all([
    supabase
      .from('rechnungen')
      .select('*, positionen:rechnung_positionen(*)')
      .eq('betrieb_id', betriebId)
      .order('erstellt_am', { ascending: false }),
    supabase
      .from('betrieb_einstellungen')
      .select('schluessel, wert')
      .eq('betrieb_id', betriebId)
      .in('schluessel', ['email_sync_aktiv', 'letzter_email_sync', 'graph_fehler', 'graph_email']),
  ])
  const geheim = await hatGeheimnisse(betriebId, ['graph_refresh_token'])

  // Abfragefehler dürfen nicht stillschweigend zu "keine Rechnungen" werden
  if (rechnungen.error) console.error('[Rechnungen] Abfrage fehlgeschlagen:', rechnungen.error)
  if (einstellungen.error) console.error('[Rechnungen] Einstellungen nicht lesbar:', einstellungen.error)

  const cfg: Record<string, string> = {}
  for (const r of einstellungen.data ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  return (
    <RechnungenContent
      rechnungen={(rechnungen.data ?? []) as any[]}
      isAdmin={isAdmin}
      ladefehler={rechnungen.error ? 'Die Rechnungen konnten nicht geladen werden. Bitte Seite neu laden.' : null}
      email={{
        verbunden: geheim.graph_refresh_token,
        aktiv: cfg.email_sync_aktiv === 'true',
        letzterSync: cfg.letzter_email_sync ?? null,
        fehler: cfg.graph_fehler ?? '',
        adresse: cfg.graph_email ?? '',
      }}
    />
  )
}
