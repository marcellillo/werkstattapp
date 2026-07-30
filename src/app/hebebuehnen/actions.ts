'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addBuehne(betriebId: string, bezeichnung: string, beschreibung: string) {
  console.log('addBuehne SERVER ACTION called:', { betriebId, bezeichnung, beschreibung })
  const supabase = createAdminClient()

  // Get max nummer
  const { data: rows, error: selectError } = await supabase
    .from('hebebuehnen')
    .select('nummer')
    .eq('betrieb_id', betriebId)
    .order('nummer', { ascending: false })
    .limit(1)

  console.log('SELECT nummer result:', { rows, selectError })

  const maxNummer = (rows && rows.length > 0) ? (rows[0] as any).nummer + 1 : 1
  console.log('maxNummer:', maxNummer)

  // Insert
  const { data, error } = await supabase
    .from('hebebuehnen')
    .insert({ betrieb_id: betriebId, nummer: maxNummer, bezeichnung, beschreibung: beschreibung || null })

  console.log('INSERT result:', { data, error })

  if (error) {
    console.error('INSERT error:', error)
    return { error: error.message }
  }

  console.log('Revalidating paths...')
  revalidatePath('/hebebuehnen')
  revalidatePath('/dashboard')
  console.log('Done!')
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
