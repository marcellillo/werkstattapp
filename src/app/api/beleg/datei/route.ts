export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pruefeZugriff } from '@/lib/auftrag-dokumente-server'
import { BELEG_BUCKETS, speicherOrt } from '@/lib/datei-urls'

// GET /api/beleg/datei?typ=lieferschein|lieferant&id=<id>
// Gescannte Lieferscheine/Rechnungen und Lieferanten-Belege (Buckets sind privat). Betriebszugehörigkeit
// wird über die Zeile in der Datenbank geprüft; Bucket und Pfad stammen aus der dort gespeicherten URL.
const TABELLEN = { lieferschein: 'lieferschein_uploads', lieferant: 'supplier_invoices' } as const

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const typ = req.nextUrl.searchParams.get('typ') as keyof typeof TABELLEN | null
  if (!id || !typ || !(typ in TABELLEN)) return NextResponse.json({ error: 'typ und id erforderlich' }, { status: 400 })

  const zugriff = await pruefeZugriff()
  if ('res' in zugriff) return zugriff.res

  const { data: beleg } = await zugriff.supabase
    .from(TABELLEN[typ]).select('datei_url')
    .eq('id', id).eq('betrieb_id', zugriff.betriebId).maybeSingle()
  const ort = speicherOrt(beleg?.datei_url)
  if (!ort || !(BELEG_BUCKETS as readonly string[]).includes(ort.bucket)) {
    return NextResponse.json({ error: 'Beleg nicht gefunden' }, { status: 404 })
  }

  const { data, error } = await createAdminClient().storage.from(ort.bucket).createSignedUrl(ort.pfad, 300)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Datei konnte nicht geladen werden' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl)
}
