import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateKostenvoranschlagNummer } from '@/lib/nummernvergabe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { auftragId, betriebId, fahrzeugId, typ } = await req.json()

    // Generiere Nummer basierend auf FIN
    const nummer = await generateKostenvoranschlagNummer(supabase, fahrzeugId, betriebId)

    const { data: kostenvoranschlag, error } = await supabase
      .from('kostenvoranschlaege')
      .insert({
        betrieb_id: betriebId,
        typ,
        nummer,
        status: 'entwurf',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ kostenvoranschlag })
  } catch (error: any) {
    console.error('[Kostenvoranschlag Create] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
