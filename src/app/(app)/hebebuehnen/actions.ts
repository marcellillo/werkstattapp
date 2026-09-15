'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addBuehne(betriebId: string, bezeichnung: string, beschreibung: string) {
  const supabase = createAdminClient()

  // Get max nummer (nur innerhalb dieses Betriebs, da Buehnen jetzt pro Betrieb getrennt sind)
  const { data: rows } = await supabase
    .from('hebebuehnen')
    .select('nummer')
    .eq('betrieb_id', betriebId)
    .order('nummer', { ascending: false })
    .limit(1)

  const maxNummer = (rows && rows.length > 0) ? (rows[0] as any).nummer + 1 : 1

  // Insert
  const { error } = await supabase
    .from('hebebuehnen')
    .insert({ betrieb_id: betriebId, nummer: maxNummer, bezeichnung, beschreibung: beschreibung || null })

  if (error) return { error: error.message }

  revalidatePath('/hebebuehnen')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateBuehne(id: string, betriebId: string, bezeichnung: string, beschreibung: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('hebebuehnen')
    .update({ bezeichnung, beschreibung: beschreibung || null })
    .eq('id', id)
    .eq('betrieb_id', betriebId)
  if (error) return { error: error.message }
  revalidatePath('/hebebuehnen')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteBuehne(id: string, betriebId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('hebebuehnen').delete().eq('id', id).eq('betrieb_id', betriebId)
  if (error) return { error: error.message }
  revalidatePath('/hebebuehnen')
  revalidatePath('/dashboard')
  return { success: true }
}
