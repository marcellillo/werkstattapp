export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIp, rateLimit } from '@/lib/rate-limit'

const TOKEN = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/freigabe/<token>/foto?id=<fotoId>
// ÖFFENTLICH (kein Login): Foto für die Freigabe-Seite des Kunden. Nur Fotos des Auftrags dieses Kostenvoranschlags, die die
// Werkstatt ausdrücklich für den Kunden freigegeben hat (fuer_kunde). Der Bucket ist privat -> kurzlebiger signierter Link.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!TOKEN.test(token) || !UUID.test(id)) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const limit = await rateLimit(`freigabe-foto:${clientIp(req)}`, 240, 600)
  if (limit) return limit

  const admin = createAdminClient()
  const { data: t } = await admin.from('kva_freigabe_tokens').select('kva_id').eq('token', token).maybeSingle()
  if (!t) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  const { data: kva } = await admin.from('kostenvoranschlaege').select('auftrag_id, betrieb_id').eq('id', t.kva_id).maybeSingle()
  if (!kva?.auftrag_id) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const { data: foto } = await admin.from('auftrag_fotos').select('storage_path')
    .eq('id', id).eq('auftrag_id', kva.auftrag_id).eq('betrieb_id', kva.betrieb_id).eq('fuer_kunde', true).maybeSingle()
  if (!foto?.storage_path) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const { data, error } = await admin.storage.from('auftrag-fotos').createSignedUrl(foto.storage_path, 300)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Datei konnte nicht geladen werden' }, { status: 500 })
  const res = NextResponse.redirect(data.signedUrl)
  res.headers.set('Cache-Control', 'private, no-store')
  res.headers.set('X-Robots-Tag', 'noindex')
  return res
}
