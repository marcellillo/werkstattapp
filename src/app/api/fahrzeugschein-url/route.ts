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
  // Nur Dateien, die /api/buchen selbst angelegt hat (kein beliebiger Pfad, kein "..")
  if (!/^online-anfragen\/[A-Za-z0-9._-]{1,200}$/.test(path) || path.includes('..')) {
    return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 })
  }

  // SICHERHEIT: Der Link wird mit Service-Role erzeugt -> ausdrücklich prüfen, dass der Pfad zu einem Termin
  // des EIGENEN Betriebs gehört (RLS der Termine-Tabelle erledigt die Betriebs-Zuordnung).
  const { data: termin } = await supabase
    .from('termine')
    .select('id')
    .ilike('notizen', `%Fahrzeugschein-Pfad: ${path.replace(/[\\%_]/g, m => '\\' + m)}%`)
    .limit(1)
    .maybeSingle()
  if (!termin) return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 })

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('fahrzeugbrief').createSignedUrl(path, 60 * 10)

  if (error || !data) {
    console.error('Fahrzeugschein Signed-URL error:', error)
    return NextResponse.json({ error: 'Link konnte nicht erstellt werden' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
