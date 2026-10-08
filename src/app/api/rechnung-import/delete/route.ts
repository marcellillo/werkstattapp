export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { entferneRechnungsDatei } from '@/lib/eingangsrechnung'
import { verlangeFinanzrolle } from '@/lib/rollen-server'
import { serverFehler } from '@/lib/api-fehler'

// Löscht eine Eingangsrechnung samt Positionen und der abgelegten Datei.
export async function POST(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  let betriebId: string
  try {
    betriebId = await getBetriebIdForUser(supabase, user.id)
  } catch {
    return NextResponse.json({ error: 'Kein Betrieb zugeordnet' }, { status: 403 })
  }

  const rolleFehler = await verlangeFinanzrolle(supabase, user.id, betriebId)
  if (rolleFehler) return rolleFehler

  const { data: rechnung } = await supabase
    .from('rechnungen').select('id, datei_pfad')
    .eq('id', id).eq('betrieb_id', betriebId).maybeSingle()
  if (!rechnung) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })

  // Positionen hängen per ON DELETE CASCADE an der Rechnung
  const { data: geloescht, error } = await supabase
    .from('rechnungen').delete().eq('id', id).eq('betrieb_id', betriebId).select('id')
  if (error) return serverFehler(error, 'rechnung-import/delete')
  if (!geloescht?.length) return NextResponse.json({ error: 'Keine Berechtigung zum Löschen' }, { status: 403 })

  await entferneRechnungsDatei(createAdminClient(), rechnung.datei_pfad)
  return NextResponse.json({ erfolg: true })
}
