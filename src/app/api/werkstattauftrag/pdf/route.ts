import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateWerkstattauftragPDF } from '@/lib/pdf-generator-werkstattauftrag'
import { resolveFirmaSettings } from '@/lib/firma-settings'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { werkstattauftragId, betriebId } = await req.json()

    // Validiere Input-Parameter
    if (!werkstattauftragId || !betriebId) {
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

    // Hole Werkstattauftrag mit Details
    const { data: wa, error: waError } = await supabase
      .from('werkstattauftraege')
      .select(`
        *,
        fahrzeug:fahrzeuge(*),
        positionen:werkstattauftrag_positionen(*)
      `)
      .eq('id', werkstattauftragId)
      .eq('betrieb_id', betriebId)
      .maybeSingle()

    if (waError) throw waError
    if (!wa) return NextResponse.json({ error: 'Werkstattauftrag nicht gefunden' }, { status: 404 })

    const firma = await resolveFirmaSettings(supabase, betriebId)

    // Hole Kunde + Arbeiten-Beschreibung über den verknüpften Auftrag
    let kunde: any = null
    let arbeiten: string = ''
    if (wa.auftrag_id) {
      const { data: auftrag } = await supabase
        .from('auftraege')
        .select('arbeiten, kunde:kunden(*)')
        .eq('id', wa.auftrag_id)
        .maybeSingle()

      if (auftrag) {
        kunde = (auftrag as any).kunde
        arbeiten = (auftrag as any).arbeiten || ''
      }
    }

    // Teileliste über den (offenen) Kostenvoranschlag desselben Auftrags — bewusst OHNE Preise,
    // der Werkstattauftrag ist für den Mechaniker, nicht für die Abrechnung.
    let teile: Array<{ beschreibung: string; menge: number }> = []
    if (wa.auftrag_id) {
      const { data: kvRows } = await supabase
        .from('kostenvoranschlaege')
        .select('id, positionen:kostenvoranschlag_position(beschreibung, menge)')
        .eq('auftrag_id', wa.auftrag_id)
        .eq('betrieb_id', betriebId)

      teile = (kvRows || []).flatMap((kv: any) =>
        (kv.positionen || []).map((pos: any) => ({
          beschreibung: pos.beschreibung,
          menge: pos.menge,
        }))
      )
    }

    // Generiere PDF
    const pdfBuffer = await generateWerkstattauftragPDF({
      nummer: wa.nummer,
      datum: new Date(wa.created_at).toLocaleDateString('de-DE'),
      auftragId: wa.auftrag_id || werkstattauftragId,
      fahrzeug: {
        marke: wa.fahrzeug?.marke || '',
        modell: wa.fahrzeug?.modell || '',
        fin: wa.fahrzeug?.fin || '',
        kennzeichen: wa.fahrzeug?.kennzeichen,
        baujahr: wa.fahrzeug?.baujahr,
        farbe: wa.fahrzeug?.farbe,
        kilometerstand: wa.fahrzeug?.kilometerstand,
        motortyp: wa.fahrzeug?.motortyp,
        hubraum: wa.fahrzeug?.hubraum,
        leistungKw: wa.fahrzeug?.leistung_kw,
        naechsteHu: wa.fahrzeug?.naechste_hauptuntersuchung,
      },
      kundenName: kunde ? `${kunde.vorname || ''} ${kunde.nachname || ''}`.trim() || 'Unbekannt' : 'Unbekannt',
      kundenStrasse: kunde?.strasse || '',
      kundenPlz: kunde?.plz || '',
      kundenOrt: kunde?.ort || '',
      kundenTelefon: kunde?.telefon,
      arbeiten,
      teile,
      firmaDaten: {
        name: firma.firma_name || 'Kfz-Werkstatt',
        strasse: firma.firma_strasse || '',
        plz: firma.firma_plz || '',
        ort: firma.firma_ort || '',
        telefon: firma.firma_telefon,
        email: firma.firma_email,
        logo: firma.firma_logo,
      },
      status: wa.status || 'neu',
    })

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Werkstattauftrag_${wa.nummer}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('[Werkstattauftrag PDF Export] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
