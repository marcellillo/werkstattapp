export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pruefeZugriff } from '@/lib/auftrag-dokumente-server'
import { DOKUMENT_BUCKET, erlaubterTyp, istKategorie } from '@/lib/auftrag-dokumente'
import { serverFehler } from '@/lib/api-fehler'

// Schritt 2 des Uploads: die hochgeladene Datei als Dokument des Auftrags eintragen.
// Prüft, dass die Datei wirklich im Ordner dieses Betriebs/Auftrags liegt, und übernimmt Typ und
// Größe aus dem Speicher (nicht aus den Angaben des Browsers).
export async function POST(req: NextRequest) {
  const { auftragId, pfad, kategorie, titel, dateiname } = await req.json().catch(() => ({}))
  if (!auftragId || typeof auftragId !== 'string' || typeof pfad !== 'string' || typeof dateiname !== 'string') {
    return NextResponse.json({ error: 'auftragId, pfad und dateiname erforderlich' }, { status: 400 })
  }

  const zugriff = await pruefeZugriff(auftragId)
  if ('res' in zugriff) return zugriff.res

  const ordner = `${zugriff.betriebId}/${auftragId}`
  if (!pfad.startsWith(ordner + '/') || pfad.includes('..') || pfad.slice(ordner.length + 1).includes('/')) {
    return NextResponse.json({ error: 'Ungültiger Dateipfad' }, { status: 400 })
  }

  const admin = createAdminClient()
  const dateiPart = pfad.slice(ordner.length + 1)
  const { data: liste, error: listErr } = await admin.storage.from(DOKUMENT_BUCKET).list(ordner, { search: dateiPart, limit: 5 })
  const objekt = liste?.find(o => o.name === dateiPart)
  if (listErr || !objekt) {
    return NextResponse.json({ error: 'Die Datei wurde nicht hochgeladen. Bitte erneut versuchen.' }, { status: 400 })
  }
  const mime = erlaubterTyp(dateiname, (objekt.metadata as any)?.mimetype)
  if (!mime) {
    await admin.storage.from(DOKUMENT_BUCKET).remove([pfad])
    return NextResponse.json({ error: 'Nur PDF und Bilder werden unterstützt' }, { status: 400 })
  }

  const { data: row, error } = await admin.from('auftrag_dokumente').insert({
    betrieb_id: zugriff.betriebId,
    auftrag_id: auftragId,
    kategorie: istKategorie(kategorie) ? kategorie : 'sonstiges',
    titel: typeof titel === 'string' && titel.trim() ? titel.trim().slice(0, 200) : null,
    datei_pfad: pfad,
    datei_name: dateiname.slice(0, 200),
    datei_typ: mime,
    groesse: Number((objekt.metadata as any)?.size) || null,
    erstellt_von: zugriff.userId,
  }).select('id, auftrag_id, kategorie, titel, datei_name, datei_typ, groesse, erstellt_am').single()

  if (error || !row) {
    await admin.storage.from(DOKUMENT_BUCKET).remove([pfad])
    return NextResponse.json({ error: `Dokument konnte nicht gespeichert werden: ${error?.message ?? 'unbekannt'}` }, { status: 500 })
  }
  return NextResponse.json({ erfolg: true, dokument: row })
}

// Kategorie und/oder Titel eines Dokuments ändern
export async function PATCH(req: NextRequest) {
  const { id, kategorie, titel } = await req.json().catch(() => ({}))
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const zugriff = await pruefeZugriff()
  if ('res' in zugriff) return zugriff.res

  const felder: Record<string, unknown> = {}
  if (kategorie !== undefined) {
    if (!istKategorie(kategorie)) return NextResponse.json({ error: 'Unbekannte Kategorie' }, { status: 400 })
    felder.kategorie = kategorie
  }
  if (titel !== undefined) felder.titel = typeof titel === 'string' && titel.trim() ? titel.trim().slice(0, 200) : null
  if (Object.keys(felder).length === 0) return NextResponse.json({ error: 'Nichts zu ändern' }, { status: 400 })

  // Zugehörigkeit zum Betrieb über den RLS-Client prüfen, geschrieben wird mit Service-Role
  const { data: vorhanden } = await zugriff.supabase.from('auftrag_dokumente').select('id').eq('id', id).eq('betrieb_id', zugriff.betriebId).maybeSingle()
  if (!vorhanden) return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })

  const { error } = await createAdminClient().from('auftrag_dokumente').update(felder).eq('id', id).eq('betrieb_id', zugriff.betriebId)
  if (error) return serverFehler(error, 'auftrag-dokument')
  return NextResponse.json({ erfolg: true })
}
