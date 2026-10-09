import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { LeistungspaketeContent } from './leistungspakete-content'

export default async function LeistungspaketePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const [{ data: pakete }, { data: cfg }, { data: rolle }] = await Promise.all([
    supabase.from('leistungspakete')
      .select('id, name, beschreibung, positionen:leistungspaket_positionen(id, art, beschreibung, menge, einzelpreis, sortierung)')
      .eq('betrieb_id', betriebId).order('name'),
    supabase.from('betrieb_einstellungen').select('wert').eq('betrieb_id', betriebId).eq('schluessel', 'firma_stundensatz').maybeSingle(),
    supabase.from('betrieb_users').select('role').eq('betrieb_id', betriebId).eq('profile_id', user.id).maybeSingle(),
  ])
  const satz = parseFloat(String(cfg?.wert ?? '').replace(',', '.'))

  return (
    <LeistungspaketeContent
      betriebId={betriebId}
      pakete={(pakete ?? []) as any[]}
      stundensatz={Number.isFinite(satz) ? satz : null}
      istAdmin={['admin', 'superadmin'].includes(rolle?.role ?? '')}
    />
  )
}
