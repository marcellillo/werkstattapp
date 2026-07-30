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

    if (!file) return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 })
    if (!betriebId) return NextResponse.json({ error: 'betriebId erforderlich' }, { status: 400 })

    // Konvertiere File zu Base64
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    // Scanne Lieferschein
    const scanResult = await scanLieferschein('', base64)

    if (!scanResult.erfolg) {
      return NextResponse.json({
        erfolg: false,
        fehler: scanResult.fehler || 'Lieferschein konnte nicht erkannt werden',
        teile: [],
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

    return NextResponse.json({
      erfolg: true,
      scannedTeile: scanResult.teile.length,
      gebuchteTeile: gebuchteTeile.length,
      unmatchedTeile,
      details: {
        lieferdatum: scanResult.lieferdatum,
        lieferant: scanResult.lieferant,
        bestellnummer: scanResult.bestellnummer,
        confidence: scanResult.confidence,
      },
    })
  } catch (error: any) {
    console.error('[Lieferschein Scan] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
