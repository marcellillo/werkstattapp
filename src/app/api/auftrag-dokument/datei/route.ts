export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pruefeZugriff } from '@/lib/auftrag-dokumente-server'
import { DOKUMENT_BUCKET } from '@/lib/auftrag-dokumente'

// GET /api/auftrag-dokument/datei?id=<dokumentId>[&download=1]
// Leitet nach Prüfung der Betriebszugehörigkeit auf einen kurzlebigen signierten Link weiter.
// Funktioniert auch als <img src> und im Druck der Auftragsmappe.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const download = req.nextUrl.searchParams.get('download') === '1'
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const zugriff = await pruefeZugriff()
  if ('res' in zugriff) return zugriff.res

  const { data: dok } = await zugriff.supabase
    .from('auftrag_dokumente').select('datei_pfad, datei_name')
    .eq('id', id).eq('betrieb_id', zugriff.betriebId).maybeSingle()
  if (!dok) return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })

  const { data, error } = await createAdminClient().storage
    .from(DOKUMENT_BUCKET)
    .createSignedUrl(dok.datei_pfad, 300, download ? { download: dok.datei_name } : undefined)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Datei konnte nicht geladen werden' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl)
}
