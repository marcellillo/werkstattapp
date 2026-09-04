import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { scanLieferschein, matchTeileZuBestellungen } from '@/lib/lieferschein-scanner'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File
    const betriebId = formData.get('betriebId') as string
    const kostenvoranschlagId = formData.get('kostenvoranschlag_id') as string | null

    if (!file) return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 })
    if (!betriebId) return NextResponse.json({ error: 'betriebId erforderlich' }, { status: 400 })

    // Konvertiere File zu Base64
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    // Scanne Lieferschein
    console.log('[API] Calling scanLieferschein with base64 length:', base64.length)
    const scanResult = await scanLieferschein('', base64, mimeType)
    console.log('[API] scanResult:', JSON.stringify(scanResult, null, 2))

    // Datei immer archivieren (auch bei fehlgeschlagenem Scan), damit man sieht,
    // was schon hochgeladen wurde und nichts versehentlich doppelt scannt.
    const timestamp = Date.now()
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    const safeFileName = `${timestamp}.${ext}`
    const storagePath = `${betriebId}/${safeFileName}`

    let dateiUrl: string | null = null
    try {
      const { error: uploadError } = await supabase.storage
        .from('supplier-invoice')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        })
      if (uploadError) {
        console.warn('[Lieferschein Storage] Upload error:', uploadError.message)
      } else {
        const { data: urlData } = supabase.storage.from('supplier-invoice').getPublicUrl(storagePath)
        dateiUrl = urlData.publicUrl
      }
    } catch (storageError: any) {
      console.warn('[Lieferschein Storage] Upload exception:', storageError.message)
    }

    if (!scanResult.erfolg) {
      if (dateiUrl) {
        await supabase.from('lieferschein_uploads').insert({
          betrieb_id: betriebId,
          kostenvoranschlag_id: kostenvoranschlagId || null,
          datei_url: dateiUrl,
          dateiname: file.name,
          erfolg: false,
          fehlermeldung: scanResult.fehler || 'Lieferschein konnte nicht erkannt werden',
        })
      }
      console.error('[API] Scan FAILED:', {
        fehler: scanResult.fehler,
        confidence: scanResult.confidence,
        teilCount: scanResult.teile.length,
      })
      return NextResponse.json({
        erfolg: false,
        fehler: scanResult.fehler || `Lieferschein konnte nicht erkannt werden (confidence: ${scanResult.confidence.toFixed(2)})`,
        teile: [],
        confidence: scanResult.confidence,
      })
    }

    // Versuche Teile zu bestehenden Bestellungen zuzuordnen
    const { data: bestellungen } = await supabase
      .from('ersatzteile')
      .select('*')
      .eq('betrieb_id', betriebId)
      .is('gebucht_am', null) // Nur noch nicht gebuchte Bestellungen

    const matched = await matchTeileZuBestellungen(
      scanResult.teile,
      bestellungen || []
    )

    // Buche automatisch ein, wenn Match vorhanden
    const gebuchteTeile = []
    for (const [teil, bestellung] of matched.entries()) {
      const { error } = await supabase
        .from('ersatzteile')
        .update({
          gebucht_am: new Date().toISOString(),
          status: 'geliefert',
        })
        .eq('id', bestellung.id)

      if (!error) {
        gebuchteTeile.push({
          teilenummer: teil.teilenummer,
          beschreibung: teil.beschreibung,
          menge: teil.menge,
          status: 'eingebucht',
        })
      }
    }

    // Ungematche Teile für manuelle Zuordnung
    const unmatchedTeile = scanResult.teile.filter(t => !matched.has(t))

    if (dateiUrl) {
      await supabase.from('lieferschein_uploads').insert({
        betrieb_id: betriebId,
        kostenvoranschlag_id: kostenvoranschlagId || null,
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
      scannedTeile: scanResult.teile.length,
      gebuchteTeile: gebuchteTeile.length,
      unmatchedTeile,
      details: {
        lieferdatum: scanResult.lieferdatum,
        lieferant: scanResult.lieferant,
        bestellnummer: scanResult.bestellnummer,
        vermuteteArbeit: scanResult.vermuteteArbeit,
        confidence: scanResult.confidence,
      },
    })
  } catch (error: any) {
    console.error('[Lieferschein Scan] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
