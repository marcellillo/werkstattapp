import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PUT /api/rechnungen/fahrzeug/[id]
 * Ändert die Rechnungsnummer nachträglich (z.B. für Korrektionen)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rechnungId = (await params).id
    const { rechnungsnummer } = await req.json()

    if (!rechnungsnummer || typeof rechnungsnummer !== 'number') {
      return NextResponse.json(
        { error: 'Gültige Rechnungsnummer erforderlich' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Prüfe ob Nummer bereits existiert (außer dieser Rechnung)
    const { data: existing } = await supabase
      .from('fahrzeug_rechnungen')
      .select('id')
      .eq('rechnungsnummer', rechnungsnummer)
      .neq('id', rechnungId)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: `Rechnungsnummer ${rechnungsnummer} existiert bereits` },
        { status: 409 }
      )
    }

    // Update
    const { data, error } = await supabase
      .from('fahrzeug_rechnungen')
      .update({ rechnungsnummer })
      .eq('id', rechnungId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      rechnungsnummer: data.rechnungsnummer,
      message: `Rechnungsnummer geändert zu ${rechnungsnummer}`,
    })
  } catch (error) {
    console.error('Fehler:', error)
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren' },
      { status: 500 }
    )
  }
}
