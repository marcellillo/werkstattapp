import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateKostenvoranschlagPDF } from '@/lib/pdf-generator'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { kostenvoranschlagId, betriebId } = await req.json()

    // Hole Kostenvoranschlag mit Details
    const { data: kv } = await supabase
      .from('kostenvoranschlaege')
      .select(`
        *,
        positionen:kostenvoranschlag_positionen(*)
      `)
      .eq('id', kostenvoranschlagId)
      .eq('betrieb_id', betriebId)
      .single()

    if (!kv) return NextResponse.json({ error: 'Kostenvoranschlag nicht gefunden' }, { status: 404 })

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
      .eq('id', kv.kunde_id)
      .single()

    // Hole Fahrzeug-Daten
    const { data: fahrzeug } = await supabase
      .from('fahrzeuge')
      .select('*')
      .eq('id', kv.fahrzeug_id)
      .single()

    if (!betrieb) throw new Error('Betrieb nicht gefunden')

    // Berechne Summen
    const summeNetto = (kv.positionen || []).reduce((sum: number, pos: any) => sum + (pos.summe || 0), 0)
    const mehrwertsteuer = summeNetto * 0.19

    // Generiere PDF
    const pdfBuffer = await generateKostenvoranschlagPDF({
      nummer: kv.nummer,
      datum: new Date(kv.created_at).toLocaleDateString('de-DE'),
      kundenName: kunde?.name || 'Unbekannt',
      kundenAdresse: kunde?.strasse || '',
      kundenOrt: `${kunde?.plz || ''} ${kunde?.ort || ''}`,
      fahrzeug: {
        marke: fahrzeug?.marke || '',
        modell: fahrzeug?.modell || '',
        fin: fahrzeug?.fin || '',
        kennzeichen: fahrzeug?.kennzeichen,
      },
      positionen: (kv.positionen || []).map((pos: any) => ({
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
      },
    })

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Kostenvoranschlag_${kv.nummer}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('[PDF Export] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
