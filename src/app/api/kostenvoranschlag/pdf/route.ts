import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generatePDF } from '@/lib/pdf-generator'
import { resolveFirmaSettings } from '@/lib/firma-settings'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { kostenvoranschlagId, betriebId } = await req.json()

    // Validiere Input-Parameter
    if (!kostenvoranschlagId || !betriebId) {
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

    // Hole Kostenvoranschlag mit Details
    const { data: kv, error: kvError } = await supabase
      .from('kostenvoranschlaege')
      .select(`
        *,
        positionen:kostenvoranschlag_position(*)
      `)
      .eq('id', kostenvoranschlagId)
      .eq('betrieb_id', betriebId)
      .maybeSingle()

    if (kvError) throw kvError
    if (!kv) return NextResponse.json({ error: 'Kostenvoranschlag nicht gefunden' }, { status: 404 })

    const firma = await resolveFirmaSettings(supabase, betriebId)

    // Hole Kunde-Daten (optional)
    const kundeResult = kv.kunde_id
      ? await supabase
          .from('kunden')
          .select('*')
          .eq('id', kv.kunde_id)
          .maybeSingle()
      : { data: null }
    const { data: kunde } = kundeResult

    // Hole Fahrzeug-Daten (optional)
    const fahrzeugResult = kv.fahrzeug_id
      ? await supabase
          .from('fahrzeuge')
          .select('*')
          .eq('id', kv.fahrzeug_id)
          .maybeSingle()
      : { data: null }
    const { data: fahrzeug } = fahrzeugResult

    // Berechne Summen (Spalten heißen einzelpreis/gesamtpreis, nicht preis/summe)
    const kleinunternehmer = firma.firma_kleinunternehmer === 'ja'
    const summeNetto = (kv.positionen || []).reduce((sum: number, pos: any) => sum + (pos.gesamtpreis || 0), 0)
    const mehrwertsteuer = kleinunternehmer ? 0 : summeNetto * 0.19
    const summeBrutto = summeNetto + mehrwertsteuer

    // Generiere PDF
    const pdfBuffer = await generatePDF('kostenvoranschlag', {
      logoBase64: firma.firma_logo || '',
      betriebName: firma.firma_name || 'Kfz-Werkstatt',
      betriebAdresse: `${firma.firma_strasse || ''}, ${firma.firma_plz || ''} ${firma.firma_ort || ''}`,
      betriebTel: firma.firma_telefon || '',
      kvaNummer: kv.nummer,
      datum: new Date(kv.created_at).toLocaleDateString('de-DE'),
      gueltigBis: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE'),
      fahrzeugMarke: fahrzeug?.marke || '',
      fahrzeugModell: fahrzeug?.modell || '',
      fahrzeugKennzeichen: fahrzeug?.kennzeichen || '',
      fahrzeugFin: fahrzeug?.fin || '',
      kundeName: kunde ? `${kunde.vorname || ''} ${kunde.nachname || ''}`.trim() || 'Unbekannt' : 'Unbekannt',
      kundeAdresse: kunde?.strasse || '',
      kundeOrt: `${kunde?.plz || ''} ${kunde?.ort || ''}`,
      positionen: (kv.positionen || []).map((pos: any) => ({
        beschreibung: pos.beschreibung,
        menge: pos.menge,
        preis: pos.einzelpreis || 0,
        summe: pos.gesamtpreis || 0,
      })),
      summeNetto: summeNetto.toFixed(2),
      mwst: mehrwertsteuer.toFixed(2),
      summeBrutto: summeBrutto.toFixed(2),
      gueltigkeitsTage: '30',
    } as any)

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
