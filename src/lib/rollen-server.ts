// Rollenprüfung für Server-Routen (die Oberfläche blendet Menüs nur aus -- durchgesetzt wird hier und in der DB).
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const FINANZ_ROLLEN = ['admin', 'superadmin', 'buchhalter']
export const ADMIN_ROLLEN = ['admin', 'superadmin']

/** Gibt eine 403-Antwort zurück, wenn der Nutzer im Betrieb keine der erlaubten Rollen hat, sonst null. */
export async function verlangeRolle(
  supabase: SupabaseClient,
  userId: string,
  betriebId: string,
  erlaubt: string[],
  meldung = 'Dafür fehlt Ihnen die Berechtigung.',
): Promise<NextResponse | null> {
  const { data } = await supabase
    .from('betrieb_users')
    .select('role')
    .eq('betrieb_id', betriebId)
    .eq('profile_id', userId)
    .maybeSingle()
  if (!data || !erlaubt.includes(data.role)) return NextResponse.json({ error: meldung }, { status: 403 })
  return null
}

export const verlangeFinanzrolle = (supabase: SupabaseClient, userId: string, betriebId: string) =>
  verlangeRolle(supabase, userId, betriebId, FINANZ_ROLLEN, 'Rechnungen dürfen nur Administratoren und Buchhalter bearbeiten.')
