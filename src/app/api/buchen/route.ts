import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // CORS-Header damit die Website den Endpunkt aufrufen darf
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-booking-secret',
  }

  // Secret prüfen
  const secret = req.headers.get('x-booking-secret')
  if (secret !== process.env.BOOKING_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers })
  }

  const { vorname, nachname, telefon, email, kennzeichen, marke_modell, leistung, datum, uhrzeit, nachricht } = body

  if (!vorname || !nachname || !telefon || !leistung || !datum) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400, headers })
  }

  const titel = `${leistung} – ${vorname} ${nachname}`
  const beschreibung = [
    `Kunde: ${vorname} ${nachname}`,
    `Telefon: ${telefon}`,
    email ? `E-Mail: ${email}` : null,
    kennzeichen ? `Kennzeichen: ${kennzeichen}` : null,
    marke_modell ? `Fahrzeug: ${marke_modell}` : null,
    nachricht ? `Nachricht: ${nachricht}` : null,
  ].filter(Boolean).join('\n')

  const { error } = await supabase.from('termine').insert({
    titel,
    beschreibung,
    datum,
    uhrzeit: uhrzeit || null,
    dauer_minuten: 60,
    typ: 'online',
    quelle: 'website',
    status: 'offen',
    notizen: `Online-Buchung von der Website`,
  })

  if (error) {
    console.error('Termin insert error:', error)
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500, headers })
  }

  return NextResponse.json({ success: true }, { headers })
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-booking-secret',
    },
  })
}
