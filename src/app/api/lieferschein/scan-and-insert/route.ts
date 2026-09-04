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

    if (!file || !auftragId || !betriebId) {
      return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 })
    }

    // Konvertiere zu Base64
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    console.log('[Scan+Insert] Scanne Lieferschein...')

    // Scanne Lieferschein
    const scanResult = await scanLieferschein('', base64)

    if (!scanResult.erfolg) {
      return NextResponse.json({
        erfolg: false,
        fehler: scanResult.fehler,
        teile: [],
      })
    }

    console.log('[Scan+Insert] Validiere und füge Teile ein...')

    // Lade Werkstattauftrag des Auftrags
    const { data: wa } = await supabase
      .from('werkstattauftraege')
      .select('id')
      .eq('auftrag_id', auftragId)
      .eq('betrieb_id', betriebId)
      .limit(1)
      .single()

    // Validiere und füge Teile ein
    const { validated, inserted } = await validateAndInsertParts(
      auftragId,
      betriebId,
      scanResult.teile,
      wa?.id
    )

    console.log(`[Scan+Insert] ${inserted}/${validated.length} Teile eingefügt`)

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
