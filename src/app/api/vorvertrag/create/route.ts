import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateVorvertragNummer } from '@/lib/nummernvergabe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      fahrzeug_id,
      betrieb_id,
      kaeufer_name,
      kaeufer_strasse,
      kaeufer_plz,
      kaeufer_ort,
      kaeufer_telefon,
      kaufpreis,
      anzahlung,
      restzahlung,
      zahlungsfrist,
      uebergabedatum,
      status,
    } = await req.json()

    if (!fahrzeug_id || !betrieb_id || !kaeufer_name || !kaufpreis) {
      return NextResponse.json(
        { error: 'fahrzeug_id, betrieb_id, kaeufer_name, kaufpreis erforderlich' },
        { status: 400 }
      )
    }

    // Prüfe Betrieb-Zugriff
    const { data: betriebCheck } = await supabase
      .from('betrieb_users')
      .select('id')
      .eq('betrieb_id', betrieb_id)
      .eq('user_id', user.id)
      .single()

    if (!betriebCheck) {
      return NextResponse.json({ error: 'Betrieb-Zugriff verweigert' }, { status: 403 })
    }

    // Generiere Nummer
    const nummer = await generateVorvertragNummer(supabase, fahrzeug_id, betrieb_id)

    // Erstelle Vorvertrag
    const { data, error } = await supabase
      .from('vorvertraege')
      .insert({
        betrieb_id,
        fahrzeug_id,
        nummer,
        kaeufer_name,
        kaeufer_strasse,
        kaeufer_plz,
        kaeufer_ort,
        kaeufer_telefon,
        kaufpreis,
        anzahlung: anzahlung || null,
        restzahlung: restzahlung || null,
        zahlungsfrist: zahlungsfrist || null,
        uebergabedatum: uebergabedatum || null,
        status: status || 'entwurf',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[Vorvertrag Create] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
