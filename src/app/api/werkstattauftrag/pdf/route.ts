import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateWerkstattauftragPDF } from '@/lib/pdf-generator-werkstattauftrag'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { auftragId, betriebId } = await req.json()

    // Hole Auftrag mit Details
    const { data: auftrag } = await supabase
      .from('auftraege')
      .select(`
        *,
        fahrzeug:fahrzeuge(*),
        kunde:kunden(*),
        ersatzteile(*)
      `)
      .eq('id', auftragId)
      .eq('betrieb_id', betriebId)
      .single()

    if (!auftrag) return NextResponse.json({ error: 'Auftrag nicht gefunden' }, { status: 404 })

    // Hole Betrieb-Daten
    const { data: betrieb } = await supabase
      .from('betriebe')
      .select('*')
      .eq('id', betriebId)
      .single()

    if (!betrieb) throw new Error('Betrieb nicht gefunden')

    // Generiere PDF
    const pdfBuffer = await generateWerkstattauftragPDF({
      nummer: auftrag.auftrag_nr || auftrag.id,
      datum: new Date(auftrag.erstellt_am).toLocaleDateString('de-DE'),
      auftragId: auftrag.id,
      fahrzeug: {
        marke: auftrag.fahrzeug?.marke || '',
        modell: auftrag.fahrzeug?.modell || '',
        fin: auftrag.fahrzeug?.fin || '',
        kennzeichen: auftrag.fahrzeug?.kennzeichen,
        baujahr: auftrag.fahrzeug?.baujahr,
        farbe: auftrag.fahrzeug?.farbe,
        kilometerstand: auftrag.fahrzeug?.kilometerstand,
      },
      kundenName: auftrag.kunde?.name || 'Unbekannt',
      kundenStrasse: auftrag.kunde?.strasse || '',
      kundenPlz: auftrag.kunde?.plz || '',
      kundenOrt: auftrag.kunde?.ort || '',
      kundenTelefon: auftrag.kunde?.telefon,
      arbeiten: auftrag.arbeiten,
      bemerkungen: auftrag.bemerkungen,
      ersatzteile: (auftrag.ersatzteile || []).map((teil: any) => ({
        teilenummer: teil.teilenummer,
        beschreibung: teil.beschreibung,
        menge: teil.menge,
        einzelpreis: teil.einzelpreis || 0,
        status: teil.status || 'nicht_bestellt',
      })),
      firmaDaten: {
        name: betrieb.name,
        strasse: betrieb.strasse || '',
        plz: betrieb.plz || '',
        ort: betrieb.ort || '',
        telefon: betrieb.telefon,
        email: betrieb.email,
        ustId: betrieb.ust_id,
      },
      status: auftrag.status || 'angenommen',
      faelligkeitsDatum: auftrag.faellig_am ? new Date(auftrag.faellig_am).toLocaleDateString('de-DE') : undefined,
    })

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Werkstattauftrag_${auftrag.auftrag_nr || auftrag.id}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('[Werkstattauftrag PDF Export] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
