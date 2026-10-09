export const runtime = 'nodejs'
// Rechnungs-PDFs (Chromium) + viele Dateien zusammenführen: braucht die volle Laufzeit
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pruefeZugriff } from '@/lib/auftrag-dokumente-server'
import { baueKomplettMappe } from '@/lib/mappe-pdf'
import { MAPPEN_BUCKET } from '@/lib/auftrag-dokumente'
import { rateLimit } from '@/lib/rate-limit'
import { serverFehler } from '@/lib/api-fehler'

// POST /api/mappe/komplett-pdf  { auftragId }
// Baut die Auftragsmappe als EIN PDF (Deckblatt mit anklickbarem Inhaltsverzeichnis, Lesezeichen, alle Dateien als
// Seiten, Originale als Anhänge), legt sie im privaten Bucket ab und liefert kurzlebige Links. (Direkt als Antwort
// wäre sie wegen der 4,5-MB-Grenze von Serverfunktionen oft zu groß.)
export async function POST(req: NextRequest) {
  const { auftragId } = await req.json().catch(() => ({}))
  if (typeof auftragId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(auftragId)) {
    return NextResponse.json({ error: 'auftragId fehlt' }, { status: 400 })
  }
  const zugriff = await pruefeZugriff(auftragId)
  if ('res' in zugriff) return zugriff.res
  const limit = await rateLimit(`mappe-komplett:${zugriff.userId}`, 8, 600)
  if (limit) return limit

  try {
    const mappe = await baueKomplettMappe(zugriff.supabase, zugriff.betriebId, auftragId)
    if (!mappe) return NextResponse.json({ error: 'Auftrag nicht gefunden' }, { status: 404 })

    const admin = createAdminClient()
    const pfad = `${zugriff.betriebId}/${auftragId}.pdf`
    const { error: upErr } = await admin.storage.from(MAPPEN_BUCKET).upload(pfad, mappe.bytes, { contentType: 'application/pdf', upsert: true })
    if (upErr) throw upErr

    const dateiname = `Auftragsmappe_${mappe.auftragNr || auftragId.slice(0, 8)}.pdf`.replace(/[^A-Za-z0-9._-]/g, '_')
    const [ansehen, laden] = await Promise.all([
      admin.storage.from(MAPPEN_BUCKET).createSignedUrl(pfad, 900),
      admin.storage.from(MAPPEN_BUCKET).createSignedUrl(pfad, 900, { download: dateiname }),
    ])
    if (ansehen.error || laden.error || !ansehen.data || !laden.data) throw ansehen.error ?? laden.error ?? new Error('Link fehlt')

    return NextResponse.json({
      url: ansehen.data.signedUrl,
      downloadUrl: laden.data.signedUrl,
      dateiname,
      seiten: mappe.seiten,
      dateien: mappe.dateien,
      fotos: mappe.fotos,
      angehaengt: mappe.angehaengt,
      groesse: mappe.bytes.length,
      hinweise: mappe.hinweise,
    })
  } catch (e) {
    return serverFehler(e, 'mappe/komplett-pdf')
  }
}
