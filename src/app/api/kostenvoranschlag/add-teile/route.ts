import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { kostenvoranschlag_id, betrieb_id, teile } = await req.json()

    console.log('[Add-Teile] Input:', { kostenvoranschlag_id, betrieb_id, teilCount: teile?.length })

    if (!kostenvoranschlag_id || !teile || !Array.isArray(teile)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Füge jedes Teil zur Tabelle hinzu (mit 45% Aufschlag auf Preis wenn vorhanden)
    const positionen = teile.map(teil => {
      const einzelpreis = teil.preis ? teil.preis * 1.45 : undefined
      const gesamtpreis = einzelpreis ? einzelpreis * (teil.menge || 1) : undefined

      return {
        kostenvoranschlag_id,
        betrieb_id,
        beschreibung: teil.beschreibung || '',
        menge: teil.menge || 1,
        ...(einzelpreis && { einzelpreis }),
        ...(gesamtpreis && { gesamtpreis }),
      }
    })

    console.log('[Add-Teile] Positionen to insert:', JSON.stringify(positionen, null, 2))

    const { data, error } = await supabase
      .from('kostenvoranschlag_position')
      .insert(positionen)
      .select()

    console.log('[Add-Teile] DB Response:', { error, dataCount: data?.length })
    if (error) {
      console.error('[Add-Teile] DB Error:', error)
      throw new Error(`DB Error: ${error.message}`)
    }

    // Sobald echte Einzelteile erfasst wurden, auf "Einzeln"-Modus umstellen —
    // sonst würde die Rechnung weiterhin die (meist leere) Festpreis-Pauschale nehmen
    // statt der Summe der tatsächlich erfassten Teile.
    if ((data?.length || 0) > 0) {
      await supabase
        .from('kostenvoranschlaege')
        .update({ ersatzteile_modus: 'einzeln' })
        .eq('id', kostenvoranschlag_id)
    }

    return NextResponse.json({
      erfolg: true,
      hinzugefuegt: data?.length || 0,
      teile: data || [],
    })
  } catch (error: any) {
    console.error('[Kostenvoranschlag Add-Teile] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
