import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TuevWeckerContent } from './tuev-wecker-content'
import { getBetriebIdForUser } from '@/lib/server-betrieb'

export default async function TuevWeckerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const { data: fahrzeugeRaw } = await supabase
    .from('fahrzeuge')
    .select('id, betrieb_id, kennzeichen, marke, modell, naechste_hauptuntersuchung, tuev_erinnerung, kunden_id, kunde:kunden(id, vorname, nachname, telefon, email)')
    .eq('betrieb_id', betriebId)
    .not('naechste_hauptuntersuchung', 'is', null)
    .neq('tuev_erinnerung', false)
    .order('naechste_hauptuntersuchung', { ascending: true })

  return (
    <TuevWeckerContent fahrzeuge={(fahrzeugeRaw ?? []) as any[]} />
  )
}
