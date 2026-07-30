import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateVorvertragPDF } from '@/lib/pdf-generator-vorvertrag'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { vorvertragId, betriebId } = await req.json()

    // Hole Vorvertrag
    const { data: vorvertrag } = await supabase
      .from('vorvertraege')
      .select('*')
      .eq('id', vorvertragId)
      .eq('betrieb_id', betriebId)
      .single()

    if (!vorvertrag) return NextResponse.json({ error: 'Vorvertrag nicht gefunden' }, { status: 404 })

    // Hole Betrieb-Daten
    const { data: betrieb } = await supabase
      .from('betriebe')
      .select('*')
      .eq('id', betriebId)
      .single()

    // Hole Fahrzeug-Daten
    const { data: fahrzeug } = await supabase
      .from('fahrzeuge')
      .select('*')
      .eq('id', vorvertrag.fahrzeug_id)
      .single()

    if (!betrieb || !fahrzeug) throw new Error('Betrieb oder Fahrzeug nicht gefunden')

    // Generiere PDF
    const pdfBuffer = await generateVorvertragPDF({
      nummer: vorvertrag.nummer,
      datum: new Date(vorvertrag.created_at).toLocaleDateString('de-DE'),
      kaeuferName: vorvertrag.kaeufer_name,
      kaeuferStrasse: vorvertrag.kaeufer_strasse,
      kaeuferPlz: vorvertrag.kaeufer_plz,
      kaeuferOrt: vorvertrag.kaeufer_ort,
      kaeuferTelefon: vorvertrag.kaeufer_telefon,
      fahrzeug: {
        marke: fahrzeug.marke,
        modell: fahrzeug.modell,
        fin: fahrzeug.fin,
        kennzeichen: fahrzeug.kennzeichen,
        baujahr: fahrzeug.baujahr,
        farbe: fahrzeug.farbe,
        kilometerstand: fahrzeug.kilometerstand,
      },
      kaufpreis: vorvertrag.kaufpreis,
      anzahlung: vorvertrag.anzahlung,
      restzahlung: vorvertrag.restzahlung,
      zahlungsfrist: vorvertrag.zahlungsfrist,
      uebergabedatum: vorvertrag.uebergabedatum,
      firmaDaten: {
        name: betrieb.name,
        strasse: betrieb.strasse || '',
        plz: betrieb.plz || '',
        ort: betrieb.ort || '',
        telefon: betrieb.telefon,
        email: betrieb.email,
        ustId: betrieb.ust_id,
      },
    })

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Vorvertrag_${vorvertrag.nummer}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('[Vorvertrag PDF Export] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
