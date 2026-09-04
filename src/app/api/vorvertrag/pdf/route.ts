import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateVorvertragPDF } from '@/lib/pdf-generator-vorvertrag'
import { resolveFirmaSettings } from '@/lib/firma-settings'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { vorvertragId, betriebId } = await req.json()

    // Validiere Input-Parameter
    if (!vorvertragId || !betriebId) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // Überprüfe, ob User dieser betriebId angehört
    const { data: betriebCheck, error: checkError } = await supabase
      .from('betrieb_users')
      .select('id')
      .eq('betrieb_id', betriebId)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (checkError) throw checkError
    if (!betriebCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Hole Vorvertrag
    const { data: vorvertrag, error: vorvertragError } = await supabase
      .from('vorvertraege')
      .select('*')
      .eq('id', vorvertragId)
      .eq('betrieb_id', betriebId)
      .maybeSingle()

    if (vorvertragError) throw vorvertragError
    if (!vorvertrag) return NextResponse.json({ error: 'Vorvertrag nicht gefunden' }, { status: 404 })

    const firma = await resolveFirmaSettings(supabase, betriebId)

    // Hole Fahrzeug-Daten
    const { data: fahrzeug, error: fahrzeugError } = await supabase
      .from('fahrzeuge')
      .select('*')
      .eq('id', vorvertrag.fahrzeug_id)
      .maybeSingle()

    if (fahrzeugError) throw fahrzeugError
    if (!fahrzeug) throw new Error('Fahrzeug nicht gefunden')

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
        name: firma.firma_name || 'Kfz-Werkstatt',
        strasse: firma.firma_strasse || '',
        plz: firma.firma_plz || '',
        ort: firma.firma_ort || '',
        telefon: firma.firma_telefon,
        email: firma.firma_email,
        ustId: firma.firma_ust_id,
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
