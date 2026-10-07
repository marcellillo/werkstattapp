export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pruefeZugriff } from '@/lib/auftrag-dokumente-server'
import { DOKUMENT_BUCKET } from '@/lib/auftrag-dokumente'

// Löscht ein Dokument samt Datei.
export async function POST(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const zugriff = await pruefeZugriff()
  if ('res' in zugriff) return zugriff.res

  const { data: dok } = await zugriff.supabase
    .from('auftrag_dokumente').select('id, datei_pfad')
    .eq('id', id).eq('betrieb_id', zugriff.betriebId).maybeSingle()
  if (!dok) return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })

  const admin = createAdminClient()
  const { error } = await admin.from('auftrag_dokumente').delete().eq('id', id).eq('betrieb_id', zugriff.betriebId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: storageErr } = await admin.storage.from(DOKUMENT_BUCKET).remove([dok.datei_pfad])
  if (storageErr) console.error('[Dokumente] Datei konnte nicht entfernt werden:', storageErr.message)
  return NextResponse.json({ erfolg: true })
}
