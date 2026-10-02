import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { ladeBetriebsstoffeMitBestand, ladeBewegungen } from '@/lib/betriebsstoffe'
import { BetriebsstoffeContent } from './betriebsstoffe-content'

export default async function BetriebsstoffePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const [stoffe, bewegungen] = await Promise.all([
    ladeBetriebsstoffeMitBestand(supabase, betriebId),
    ladeBewegungen(supabase, betriebId),
  ])

  return <BetriebsstoffeContent betriebId={betriebId} initialStoffe={stoffe} initialBewegungen={bewegungen} />
}
