import { generatePDF } from '@/lib/pdf-generator'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

// Kaltstart von @sparticuz/chromium + Rendern braucht mehr als das Standard-Timeout
export const maxDuration = 30

const ERLAUBTE_TEMPLATES = ['kostenvoranschlag', 'rechnung', 'werkstattauftrag']

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rlAntwort = await rateLimit(`pdf:${user.id}`, 80, 600)
    if (rlAntwort) return rlAntwort

    const { template, data } = await req.json()

    if (!template || !data) {
      return NextResponse.json({ error: 'Template und Daten erforderlich' }, { status: 400 })
    }
    if (!ERLAUBTE_TEMPLATES.includes(template)) {
      return NextResponse.json({ error: 'Unbekanntes Template' }, { status: 400 })
    }

    console.log('[PDF] Generiere:', template)

    // Die Daten stammen vom Browser des Nutzers: ALLES wird maskiert (auch "HTML-Bausteine")
    const pdfBuffer = await generatePDF(template, data, { vertrauenswuerdig: false })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${template}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('[PDF Error]:', error)
    return NextResponse.json({ error: 'PDF konnte nicht erstellt werden' }, { status: 500 })
  }
}
