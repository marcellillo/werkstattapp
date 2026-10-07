export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pruefeZugriff } from '@/lib/auftrag-dokumente-server'

// GET /api/auftrag-foto/datei?id=<fotoId>
// Foto eines Auftrags (Bucket ist privat): nach Prüfung der Betriebszugehörigkeit Weiterleitung auf einen
// kurzlebigen signierten Link. Funktioniert als <img src>, auch im Druck der Auftragsmappe.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const zugriff = await pruefeZugriff()
  if ('res' in zugriff) return zugriff.res

  const { data: foto } = await zugriff.supabase
    .from('auftrag_fotos').select('storage_path')
    .eq('id', id).eq('betrieb_id', zugriff.betriebId).maybeSingle()
  if (!foto?.storage_path) return NextResponse.json({ error: 'Foto nicht gefunden' }, { status: 404 })

  const { data, error } = await createAdminClient().storage.from('auftrag-fotos').createSignedUrl(foto.storage_path, 300)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Datei konnte nicht geladen werden' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl)
}
