import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateRechnungPDF } from '@/lib/pdf-generator-rechnung'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { rechnungId, betriebId } = await req.json()

    // Hole Rechnung mit Details
    const { data: rechnung } = await supabase
      .from('rechnungen')
      .select(`
        *,
        positionen:rechnung_positionen(*)
      `)
      .eq('id', rechnungId)
      .eq('betrieb_id', betriebId)
      .single()

    if (!rechnung) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })

    // Hole Betrieb-Daten
    const { data: betrieb } = await supabase
      .from('betriebe')
      .select('*')
      .eq('id', betriebId)
      .single()

    // Hole Kunde-Daten
    const { data: kunde } = await supabase
      .from('kunden')
      .select('*')
      .eq('id', rechnung.kunde_id)
      .single()

    // Hole Fahrzeug-Daten (falls Werkstatt-Rechnung)
    let fahrzeugData = null
    if (rechnung.typ === 'werkstatt' && rechnung.fahrzeug_id) {
      const { data: fahrzeug } = await supabase
        .from('fahrzeuge')
        .select('*')
        .eq('id', rechnung.fahrzeug_id)
        .single()
      fahrzeugData = fahrzeug
    }

    if (!betrieb) throw new Error('Betrieb nicht gefunden')

    // Berechne Summen
    const summeNetto = (rechnung.positionen || []).reduce((sum: number, pos: any) => sum + (pos.summe || 0), 0)
    const mehrwertsteuer = summeNetto * 0.19

    // Generiere PDF
    const pdfBuffer = await generateRechnungPDF({
      nummer: rechnung.nummer,
      datum: new Date(rechnung.created_at).toLocaleDateString('de-DE'),
      typ: rechnung.typ,
      status: rechnung.status,
      kundenName: kunde?.name || 'Unbekannt',
      kundenStrasse: kunde?.strasse || '',
      kundenPlz: kunde?.plz || '',
      kundenOrt: kunde?.ort || '',
      fahrzeug: fahrzeugData ? {
        marke: fahrzeugData.marke,
        modell: fahrzeugData.modell,
        fin: fahrzeugData.fin,
        kennzeichen: fahrzeugData.kennzeichen,
        baujahr: fahrzeugData.baujahr,
      } : undefined,
      kaufpreis: rechnung.typ === 'verkauf' ? rechnung.kaufpreis : undefined,
      kaeuferName: rechnung.typ === 'verkauf' ? rechnung.kaeufer_name : undefined,
      positionen: (rechnung.positionen || []).map((pos: any) => ({
        beschreibung: pos.beschreibung,
        menge: pos.menge,
        preis: pos.preis,
        summe: pos.summe,
      })),
      summeNetto,
      mehrwertsteuer,
      summeBrutto: summeNetto + mehrwertsteuer,
      firmaDaten: {
        name: betrieb.name,
        strasse: betrieb.strasse || '',
        plz: betrieb.plz || '',
        ort: betrieb.ort || '',
        telefon: betrieb.telefon,
        email: betrieb.email,
        ustId: betrieb.ust_id,
        iban: betrieb.iban,
        bic: betrieb.bic,
      },
      zahlungsbedingungen: rechnung.zahlungsbedingungen || undefined,
      notizen: rechnung.notizen || undefined,
    })

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Rechnung_${rechnung.nummer}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('[Rechnung PDF Export] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
