// Gemeinsame Zugriffsprüfung der /api/auftrag-dokument/*-Routen.
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getBetriebIdForUser } from '@/lib/server-betrieb'

export type ZugriffOk = { ok: true; supabase: SupabaseClient; userId: string; betriebId: string }
export type ZugriffFehler = { ok: false; res: NextResponse }

// Angemeldeter Nutzer + sein Betrieb. Mit `auftragId` wird zusätzlich geprüft, dass der Auftrag
// zu diesem Betrieb gehört (RLS-Client: Fremdes ist unsichtbar → 404).
export async function pruefeZugriff(auftragId?: string): Promise<ZugriffOk | ZugriffFehler> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) }

  let betriebId: string
  try {
    betriebId = await getBetriebIdForUser(supabase, user.id)
  } catch {
    return { ok: false, res: NextResponse.json({ error: 'Kein Betrieb zugeordnet' }, { status: 403 }) }
  }

  if (auftragId) {
    const { data } = await supabase.from('auftraege').select('id').eq('id', auftragId).eq('betrieb_id', betriebId).maybeSingle()
    if (!data) return { ok: false, res: NextResponse.json({ error: 'Auftrag nicht gefunden' }, { status: 404 }) }
  }
  return { ok: true, supabase, userId: user.id, betriebId }
}
