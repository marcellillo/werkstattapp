import { generatePDF } from '@/lib/pdf-generator'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ERLAUBTE_TEMPLATES = ['kostenvoranschlag', 'rechnung', 'werkstattauftrag']

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { template, data } = await req.json()

    if (!template || !data) {
      return NextResponse.json({ error: 'Template und Daten erforderlich' }, { status: 400 })
    }
    if (!ERLAUBTE_TEMPLATES.includes(template)) {
      return NextResponse.json({ error: 'Unbekanntes Template' }, { status: 400 })
    }

    console.log('[PDF] Generiere:', template)

    const pdfBuffer = await generatePDF(template, data)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${template}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('[PDF Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
