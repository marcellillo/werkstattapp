import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateWerkstattauftragPDF } from '@/lib/pdf-generator-werkstattauftrag'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { werkstattauftragId, betriebId } = await req.json()

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

    // Hole Betrieb-Daten
    const { data: betrieb, error: betriebError } = await supabase
      .from('betriebe')
      .select('*')
      .eq('id', betriebId)
      .maybeSingle()

    if (betriebError) throw betriebError
    if (!betrieb) throw new Error('Betrieb nicht gefunden')

    // Generiere PDF
    const pdfBuffer = await generateWerkstattauftragPDF({
      nummer: wa.nummer,
      datum: new Date(wa.created_at).toLocaleDateString('de-DE'),
      fahrzeug: {
        marke: wa.fahrzeug?.marke || '',
        modell: wa.fahrzeug?.modell || '',
        fin: wa.fahrzeug?.fin || '',
        kennzeichen: wa.fahrzeug?.kennzeichen,
        baujahr: wa.fahrzeug?.baujahr,
        farbe: wa.fahrzeug?.farbe,
        kilometerstand: wa.fahrzeug?.kilometerstand,
      },
      positionen: (wa.positionen || []).map((pos: any) => ({
        beschreibung: pos.beschreibung,
        menge: pos.menge,
        preis: pos.preis,
        summe: pos.summe,
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
