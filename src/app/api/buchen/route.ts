export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

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

  // Kunde suchen oder neu anlegen (Duplikat-Prüfung per Telefon oder E-Mail)
  let kundeId: string | null = null
  try {
    let existing = null
    if (telefon) {
      const { data } = await supabase.from('kunden').select('id').eq('telefon', telefon).maybeSingle()
      existing = data
    }
    if (!existing && email) {
      const { data } = await supabase.from('kunden').select('id').eq('email', email).maybeSingle()
      existing = data
    }
    if (existing) {
      kundeId = existing.id
    } else {
      const { data: neuerKunde } = await supabase.from('kunden').insert({
        vorname,
        nachname,
        telefon: telefon || null,
        email: email || null,
        quelle: 'online-buchung',
      }).select('id').single()
      if (neuerKunde) kundeId = neuerKunde.id
    }
  } catch (e) {
    console.error('Kunde upsert error:', e)
  }

  const { error } = await supabase.from('termine').insert({
    titel,
    beschreibung,
    datum,
    uhrzeit: uhrzeit || null,
    dauer_minuten: 60,
    typ: 'online',
    quelle: 'website',
    status: 'offen',
    kunden_id: kundeId,
    notizen: `Online-Buchung von der Website`,
  })

  if (error) {
    console.error('Termin insert error:', error)
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500, headers })
  }

  // Push-Benachrichtigung an alle abonnierten Geräte senden
  try {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    )
    const { data: subs } = await supabase.from('push_subscriptions').select('*')
    if (subs?.length) {
      const datumFormatted = new Date(datum + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const payload = JSON.stringify({
        title: '📅 Neue Online-Buchung',
        body: `${vorname} ${nachname} · ${leistung} · ${datumFormatted}${uhrzeit ? ' ' + uhrzeit : ''}`,
        url: '/termine',
        tag: 'online-buchung',
      })
      await Promise.allSettled(
        subs.map(sub =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          ).catch(async (err: any) => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
            }
          })
        )
      )
    }
  } catch (e) {
    console.error('Push error:', e)
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
