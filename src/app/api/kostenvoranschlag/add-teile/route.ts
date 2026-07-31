import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { kostenvoranschlag_id, teile, betrieb_id } = await req.json()

    if (!kostenvoranschlag_id || !teile || !Array.isArray(teile)) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // Füge jedes Teil als Position ein
    const positionen = teile.map((teil: any) => ({
      kostenvoranschlag_id,
      betrieb_id,
      beschreibung: teil.beschreibung,
      menge: teil.menge || 1,
      einzelpreis: teil.preis || 0,
      gesamtpreis: (teil.menge || 1) * (teil.preis || 0),
    }))

    const { data, error } = await supabase
      .from('kostenvoranschlag_position')
      .insert(positionen)
      .select()

    if (error) throw error

    // Berechne Gesamtsumme des Kostenvoranschlags
    const { data: allPositionen } = await supabase
      .from('kostenvoranschlag_position')
      .select('gesamtpreis')
      .eq('kostenvoranschlag_id', kostenvoranschlag_id)

    const gesamt = (allPositionen || []).reduce((sum: number, p: any) => sum + (p.gesamtpreis || 0), 0)

    // Update Kostenvoranschlag Gesamtsumme
    await supabase
      .from('kostenvoranschlaege')
      .update({ gesamt_betrag: gesamt })
      .eq('id', kostenvoranschlag_id)

    return NextResponse.json({
      erfolg: true,
      positionen_hinzugefuegt: data?.length || 0,
      gesamt_betrag: gesamt,
    })
  } catch (error: any) {
    console.error('[Kostenvoranschlag Add Teile] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
