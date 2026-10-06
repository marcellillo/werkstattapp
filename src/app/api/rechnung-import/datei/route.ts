export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { RECHNUNG_BUCKET } from '@/lib/eingangsrechnung'

// GET /api/rechnung-import/datei?id=<rechnungId>[&download=1]
// Prüft, dass die Rechnung zum Betrieb des angemeldeten Nutzers gehört, und leitet auf einen
// kurzlebigen signierten Link der privaten Datei weiter.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const download = req.nextUrl.searchParams.get('download') === '1'
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  let betriebId: string
  try {
    betriebId = await getBetriebIdForUser(supabase, user.id)
  } catch {
    return NextResponse.json({ error: 'Kein Betrieb zugeordnet' }, { status: 403 })
  }

  const { data: rechnung } = await supabase
    .from('rechnungen')
    .select('datei_pfad, datei_name')
    .eq('id', id).eq('betrieb_id', betriebId)
    .maybeSingle()
  if (!rechnung) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
  if (!rechnung.datei_pfad) return NextResponse.json({ error: 'Zu dieser Rechnung ist keine Datei hinterlegt' }, { status: 404 })

  const { data, error } = await createAdminClient().storage
    .from(RECHNUNG_BUCKET)
    .createSignedUrl(rechnung.datei_pfad, 120, download ? { download: rechnung.datei_name ?? true } : undefined)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Datei konnte nicht geladen werden' }, { status: 500 })
  }
  return NextResponse.redirect(data.signedUrl)
}
