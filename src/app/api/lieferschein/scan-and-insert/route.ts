import { createClient } from '@/lib/supabase/server'
import { scanLieferschein } from '@/lib/lieferschein-scanner'
import { validateAndInsertParts } from '@/lib/teile-validator'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File
    const auftragId = formData.get('auftragId') as string
    const betriebId = formData.get('betriebId') as string
    const dokumentTypRaw = formData.get('dokumentTyp') as string | null
    const dokumentTyp = dokumentTypRaw === 'rechnung' ? 'rechnung' : 'lieferschein'

    if (!file || !auftragId || !betriebId) {
      return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 })
    }

    // Konvertiere zu Base64
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    console.log(`[Scan+Insert] Scanne ${dokumentTyp}...`)

    // Scanne Dokument
    const scanResult = await scanLieferschein('', base64, mimeType)

    // Datei immer archivieren (auch bei fehlgeschlagenem Scan), damit sie in der
    // Auftragsmappe sichtbar bleibt und nichts versehentlich doppelt hochgeladen wird.
    const timestamp = Date.now()
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    const storagePath = `${betriebId}/${timestamp}.${ext}`

    let dateiUrl: string | null = null
    try {
      const { error: uploadError } = await supabase.storage
        .from('supplier-invoice')
        .upload(storagePath, buffer, { contentType: mimeType, upsert: false })
      if (uploadError) {
        console.warn('[Scan+Insert Storage] Upload error:', uploadError.message)
      } else {
        const { data: urlData } = supabase.storage.from('supplier-invoice').getPublicUrl(storagePath)
        dateiUrl = urlData.publicUrl
      }
    } catch (storageError: any) {
      console.warn('[Scan+Insert Storage] Upload exception:', storageError.message)
    }

    if (!scanResult.erfolg) {
      if (dateiUrl) {
        await supabase.from('lieferschein_uploads').insert({
          betrieb_id: betriebId,
          auftrag_id: auftragId,
          dokument_typ: dokumentTyp,
          datei_url: dateiUrl,
          dateiname: file.name,
          erfolg: false,
          fehlermeldung: scanResult.fehler || 'Dokument konnte nicht erkannt werden',
        })
      }
      return NextResponse.json({
        erfolg: false,
        fehler: scanResult.fehler,
        teile: [],
      })
    }

    // Nur bei Lieferscheinen automatisch Ersatzteile anlegen — bei Rechnungen
    // wurden die Teile in der Regel schon über den zugehörigen Lieferschein erfasst,
    // ein zweiter Import würde sie duplizieren.
    let validated: Awaited<ReturnType<typeof validateAndInsertParts>>['validated'] = []
    let inserted = 0
    if (dokumentTyp === 'lieferschein') {
      console.log('[Scan+Insert] Validiere und füge Teile ein...')
      const { data: wa } = await supabase
        .from('werkstattauftraege')
        .select('id')
        .eq('auftrag_id', auftragId)
        .eq('betrieb_id', betriebId)
        .limit(1)
        .single()

      const result = await validateAndInsertParts(auftragId, betriebId, scanResult.teile, wa?.id)
      validated = result.validated
      inserted = result.inserted
      console.log(`[Scan+Insert] ${inserted}/${validated.length} Teile eingefügt`)
    }

    if (dateiUrl) {
      await supabase.from('lieferschein_uploads').insert({
        betrieb_id: betriebId,
        auftrag_id: auftragId,
        dokument_typ: dokumentTyp,
        datei_url: dateiUrl,
        dateiname: file.name,
        lieferant: scanResult.lieferant || null,
        bestellnummer: scanResult.bestellnummer || null,
        lieferdatum: scanResult.lieferdatum || null,
        vermutete_arbeit: scanResult.vermuteteArbeit || null,
        teile_anzahl: scanResult.teile.length,
        erfolg: true,
      })
    }

    return NextResponse.json({
      erfolg: true,
      scannedTeile: validated.length,
      gueltigeTeile: validated.filter(t => t.isValid).length,
      eingefoegteTeile: inserted,
      teile: validated,
      details: {
        lieferant: scanResult.lieferant,
        bestellnummer: scanResult.bestellnummer,
        lieferdatum: scanResult.lieferdatum,
        confidence: scanResult.confidence,
      },
    })
  } catch (error: any) {
    console.error('[Scan+Insert] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Scannen' },
      { status: 500 }
    )
  }
}
