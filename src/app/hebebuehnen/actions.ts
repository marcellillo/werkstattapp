'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addBuehne(bezeichnung: string, beschreibung: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const headers = {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
  }

  // Get max nummer
  const listRes = await fetch(`${url}/rest/v1/hebebuehnen?select=nummer&order=nummer.desc&limit=1`, { headers })
  const rows = await listRes.json()
  const maxNummer = Array.isArray(rows) && rows.length > 0 ? rows[0].nummer + 1 : 1

  // Insert
  const insertRes = await fetch(`${url}/rest/v1/hebebuehnen`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ nummer: maxNummer, bezeichnung, beschreibung: beschreibung || null }),
  })

  if (!insertRes.ok) {
    const body = await insertRes.text()
    return { error: body }
  }

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
