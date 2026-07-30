'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addBuehne(betriebId: string, bezeichnung: string, beschreibung: string) {
  const supabase = createAdminClient()

  // Get max nummer
  const { data: rows } = await supabase
    .from('hebebuehnen')
    .select('nummer')
    .order('nummer', { ascending: false })
    .limit(1)

  const maxNummer = (rows && rows.length > 0) ? (rows[0] as any).nummer + 1 : 1

  // Insert
  const { error } = await supabase
    .from('hebebuehnen')
    .insert({ nummer: maxNummer, bezeichnung, beschreibung: beschreibung || null })

  if (error) return { error: error.message }

  revalidatePath('/hebebuehnen')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateBuehne(id: string, bezeichnung: string, beschreibung: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('hebebuehnen')
    .update({ bezeichnung, beschreibung: beschreibung || null })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/hebebuehnen')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteBuehne(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('hebebuehnen').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/hebebuehnen')
  revalidatePath('/dashboard')
  return { success: true }
}
