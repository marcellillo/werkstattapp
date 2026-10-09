import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rechnungPdfErzeugen } from '@/lib/rechnung-pdf'
import { serverFehler } from '@/lib/api-fehler'
import { rateLimit } from '@/lib/rate-limit'

// Kaltstart von @sparticuz/chromium + Rendern braucht mehr als das Standard-Timeout
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rlAntwort = await rateLimit(`pdf:${user.id}`, 80, 600)
    if (rlAntwort) return rlAntwort

    const { rechnungId, betriebId } = await req.json()

    if (!rechnungId || !betriebId) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

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

    const ergebnis = await rechnungPdfErzeugen(supabase, rechnungId, betriebId)
    if (!ergebnis) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    const { buffer: pdfBuffer, rechnungsNr } = ergebnis

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Rechnung_${rechnungsNr}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('[Rechnung PDF Export] Error:', error)
    return serverFehler(error, 'rechnung/pdf')
  }
}
