import { SupabaseClient } from '@supabase/supabase-js'

export async function getBetriebIdForUser(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: userBetriebe } = await supabase
    .from('betrieb_users')
    .select('betrieb_id')
    .eq('profile_id', userId)
    .order('is_primary', { ascending: false })
    .limit(1)

  const betriebId = userBetriebe?.[0]?.betrieb_id
  if (!betriebId) throw new Error('No betrieb found for user')

  return betriebId
}
