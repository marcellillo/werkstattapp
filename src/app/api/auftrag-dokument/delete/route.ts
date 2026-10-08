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
    .from('auftrag_dokumente').select('id, datei_pfad, auftrag_id')
    .eq('id', id).eq('betrieb_id', zugriff.betriebId).maybeSingle()
  if (!dok) return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })

  const admin = createAdminClient()

  // Aufbewahrung: Mappe verkaufter/übergebener Fahrzeuge -> einzelne Dokumente entfernt nur ein Administrator
  const { data: auftrag } = await admin.from('auftraege').select('status').eq('id', dok.auftrag_id).maybeSingle()
  if (auftrag && ['verkauft', 'ausgeliefert'].includes(auftrag.status)) {
    const { data: rolle } = await zugriff.supabase.from('betrieb_users').select('role')
      .eq('betrieb_id', zugriff.betriebId).eq('profile_id', zugriff.userId).maybeSingle()
    if (rolle?.role !== 'admin' && rolle?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Die Mappe verkaufter bzw. übergebener Fahrzeuge bleibt erhalten – einzelne Dokumente kann nur ein Administrator entfernen.' }, { status: 409 })
    }
  }

  const { error } = await admin.from('auftrag_dokumente').delete().eq('id', id).eq('betrieb_id', zugriff.betriebId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: storageErr } = await admin.storage.from(DOKUMENT_BUCKET).remove([dok.datei_pfad])
  if (storageErr) console.error('[Dokumente] Datei konnte nicht entfernt werden:', storageErr.message)
  return NextResponse.json({ erfolg: true })
}
