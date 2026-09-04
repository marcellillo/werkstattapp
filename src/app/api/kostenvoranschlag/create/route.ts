import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateKostenvoranschlagNummer } from '@/lib/nummernvergabe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { auftragId, betriebId, fahrzeugId, typ } = await req.json()

    console.log('[KV Create] Input:', { auftragId, betriebId, fahrzeugId, typ })

    if (!betriebId) return NextResponse.json({ error: 'betriebId erforderlich' }, { status: 400 })

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

    // Generiere Nummer
    let nummer: string
    if (fahrzeugId) {
      nummer = await generateKostenvoranschlagNummer(supabase, fahrzeugId, betriebId)
    } else {
      // Fallback: einfache Nummer ohne FIN
      const year = new Date().getFullYear().toString().slice(-2)
      const { data: lastKv } = await supabase
        .from('kostenvoranschlaege')
        .select('nummer')
        .eq('betrieb_id', betriebId)
        .ilike('nummer', `KV-${year}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let nextNum = 1
      if (lastKv?.nummer) {
        const match = lastKv.nummer.match(/(\d{4})$/)
        if (match) nextNum = parseInt(match[1]) + 1
      }
      nummer = `KV-${year}${String(nextNum).padStart(4, '0')}`
    }
    console.log('[KV Create] Generated nummer:', nummer)

    const { data: kostenvoranschlag, error } = await supabase
      .from('kostenvoranschlaege')
      .insert({
        betrieb_id: betriebId,
        typ,
        nummer,
        fahrzeug_id: fahrzeugId || null,
        auftrag_id: auftragId || null,
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('[KV Insert] Error:', error)
      throw error
    }

    return NextResponse.json({ kostenvoranschlag })
  } catch (error: any) {
    console.error('[Kostenvoranschlag Create] Full Error:', error)
    const message = error?.message || JSON.stringify(error)
    return NextResponse.json({ error: `${message}` }, { status: 500 })
  }
}
