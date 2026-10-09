export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pruefeZugriff } from '@/lib/auftrag-dokumente-server'
import { DOKUMENT_BUCKET, MAPPEN_BUCKET } from '@/lib/auftrag-dokumente'

// Nach dem Löschen eines Auftrags: die Dateien seiner Dokumente aus dem Speicher entfernen (die
// Datenbankzeilen sind per ON DELETE CASCADE schon weg). Wirkt nur, wenn der Auftrag tatsächlich
// nicht mehr existiert, und nur im Ordner des eigenen Betriebs.
export async function POST(req: NextRequest) {
  const { auftragId } = await req.json().catch(() => ({}))
  if (!auftragId || typeof auftragId !== 'string' || !/^[0-9a-f-]{36}$/i.test(auftragId)) {
    return NextResponse.json({ error: 'auftragId fehlt' }, { status: 400 })
  }

  const zugriff = await pruefeZugriff()
  if ('res' in zugriff) return zugriff.res

  const admin = createAdminClient()
  const { data: noch } = await admin.from('auftraege').select('id').eq('id', auftragId).maybeSingle()
  if (noch) return NextResponse.json({ error: 'Der Auftrag existiert noch' }, { status: 409 })

  const ordner = `${zugriff.betriebId}/${auftragId}`
  const { data: dateien } = await admin.storage.from(DOKUMENT_BUCKET).list(ordner, { limit: 1000 })
  if (dateien?.length) await admin.storage.from(DOKUMENT_BUCKET).remove(dateien.map(d => `${ordner}/${d.name}`))
  // erzeugte Komplett-PDF der Mappe ebenfalls entfernen
  await admin.storage.from(MAPPEN_BUCKET).remove([`${zugriff.betriebId}/${auftragId}.pdf`])
  return NextResponse.json({ erfolg: true, entfernt: dateien?.length ?? 0 })
}
