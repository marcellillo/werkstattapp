export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { pruefeZugriff } from '@/lib/auftrag-dokumente-server'
import { DOKUMENT_BUCKET, DOKUMENT_MAX_BYTES, bereinigeDokumentName, erlaubterTyp } from '@/lib/auftrag-dokumente'

// Schritt 1 des Uploads: kurzlebige Upload-Berechtigung für genau eine Datei. Die Datei geht dann
// direkt vom Browser in den privaten Speicher (umgeht das 4,5-MB-Limit der Server-Funktionen).
export async function POST(req: NextRequest) {
  const { auftragId, dateiname, typ, groesse } = await req.json().catch(() => ({}))
  if (!auftragId || typeof auftragId !== 'string' || typeof dateiname !== 'string') {
    return NextResponse.json({ error: 'auftragId und dateiname erforderlich' }, { status: 400 })
  }

  const zugriff = await pruefeZugriff(auftragId)
  if ('res' in zugriff) return zugriff.res

  const mime = erlaubterTyp(dateiname, typ)
  if (!mime) return NextResponse.json({ error: 'Nur PDF und Bilder (JPG, PNG, WebP, GIF) werden unterstützt' }, { status: 400 })
  const bytes = Number(groesse)
  if (!Number.isFinite(bytes) || bytes <= 0) return NextResponse.json({ error: 'Die Datei ist leer' }, { status: 400 })
  if (bytes > DOKUMENT_MAX_BYTES) return NextResponse.json({ error: 'Die Datei ist zu groß (maximal 25 MB)' }, { status: 400 })

  const pfad = `${zugriff.betriebId}/${auftragId}/${randomUUID()}-${bereinigeDokumentName(dateiname)}`
  const { data, error } = await createAdminClient().storage.from(DOKUMENT_BUCKET).createSignedUploadUrl(pfad)
  if (error || !data) {
    return NextResponse.json({ error: `Upload konnte nicht vorbereitet werden: ${error?.message ?? 'unbekannt'}` }, { status: 500 })
  }
  return NextResponse.json({ pfad, token: data.token, typ: mime })
}
