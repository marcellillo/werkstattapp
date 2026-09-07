export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Erzeugt einen zeitlich begrenzten Link zu einem Fahrzeugschein-Foto im privaten
// "fahrzeugbrief"-Bucket (Storage-Pfade werden im /api/buchen Endpunkt bzw. beim
// manuellen Fahrzeugbrief-Upload vergeben und in termine.notizen abgelegt).
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Kein Pfad angegeben' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('fahrzeugbrief').createSignedUrl(path, 60 * 10)

  if (error || !data) {
    console.error('Fahrzeugschein Signed-URL error:', error)
    return NextResponse.json({ error: error?.message || 'Link konnte nicht erstellt werden' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
