export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Ziel-Betrieb für öffentliche Online-Buchungen (Helios Automobile GmbH).
// Bevorzugt eine feste ID aus der Umgebungsvariable; fällt sonst auf Namenssuche
// zurück und, falls nur ein Betrieb existiert, auf diesen.
async function getDefaultBetriebId(): Promise<string | null> {
  if (process.env.BOOKING_BETRIEB_ID) return process.env.BOOKING_BETRIEB_ID

  const { data: byName } = await supabase
    .from('betriebe')
    .select('id')
    .ilike('name', '%helios%')
    .maybeSingle()
  if (byName?.id) return byName.id

  const { data: alle } = await supabase.from('betriebe').select('id')
  if (alle?.length === 1) return alle[0].id

  return null
}

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

  const { vorname, nachname, telefon, email, kennzeichen, marke_modell, leistung, datum, uhrzeit, nachricht, fahrzeugschein_foto, fahrzeugschein_dateiname } = body

  if (!vorname || !nachname || !telefon || !leistung || !datum) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400, headers })
  }

  // ── Fahrzeugschein-Foto aus der Online-Anfrage dauerhaft in Supabase Storage sichern ──
  // (nutzt denselben privaten "fahrzeugbrief"-Bucket wie die manuell hochgeladenen
  // Fahrzeugbriefe; der Service-Role-Client umgeht Storage-Policies, kein Setup nötig)
  let fahrzeugscheinPfad: string | null = null
  if (typeof fahrzeugschein_foto === 'string') {
    try {
      const match = fahrzeugschein_foto.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/)
      if (match) {
        const mime = match[1]
        const buffer = Buffer.from(match[2], 'base64')
        const ext = mime.split('/')[1] || 'jpg'
        const safeName = String(fahrzeugschein_dateiname || `fahrzeugschein.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `online-anfragen/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase.storage
          .from('fahrzeugbrief')
          .upload(path, buffer, { contentType: mime, upsert: false })
        if (!uploadError) fahrzeugscheinPfad = path
        else console.error('Fahrzeugschein-Upload error:', uploadError)
      }
    } catch (e) {
      console.error('Fahrzeugschein-Upload exception:', e)
    }
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

  const defaultBetriebId = await getDefaultBetriebId()
  if (!defaultBetriebId) {
    return NextResponse.json({ error: 'Keine Werkstatt für Online-Buchungen konfiguriert' }, { status: 500, headers })
  }

  // ── 1. Kunde: Duplikat per Telefon → E-Mail → neu anlegen ──────────────
  let kundeId: string | null = null
  try {
    let existing: any = null
    const kzNorm = kennzeichen?.toUpperCase().replace(/\s+/g, '') ?? null

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
        betrieb_id: defaultBetriebId,
        vorname, nachname,
        telefon: telefon || null,
        email: email || null,
      }).select('id').single()
      if (neuerKunde) kundeId = neuerKunde.id
    }

    // ── 2. Fahrzeug: Duplikat per Kennzeichen → neu anlegen ─────────────
    let fahrzeugId: string | null = null
    if (kzNorm) {
      const { data: existingFz } = await supabase.from('fahrzeuge').select('id').eq('kennzeichen', kzNorm).maybeSingle()
      if (existingFz) {
        fahrzeugId = existingFz.id
        // Kunden-Verknüpfung aktualisieren falls noch nicht gesetzt
        if (kundeId) await supabase.from('fahrzeuge').update({ kunden_id: kundeId }).eq('id', fahrzeugId).is('kunden_id', null)
      } else {
        // marke_modell z.B. "VW Golf" → marke="VW", modell="Golf"
        const parts = (marke_modell ?? '').trim().split(/\s+/)
        const marke = parts[0] || null
        const modell = parts.slice(1).join(' ') || null
        const { data: neuesFz, error: fzError } = await supabase.from('fahrzeuge').insert({
          betrieb_id: defaultBetriebId,
          kunden_id: kundeId,
          fahrzeug_typ: 'fremd',
          kennzeichen: kzNorm,
          marke,
          modell,
        }).select('id').single()
        if (fzError) console.error('Fahrzeug insert error:', fzError)
        if (neuesFz) fahrzeugId = neuesFz.id
      }
    }

    // ── 3. Auftrag anlegen ────────────────────────────────────────────────
    if (fahrzeugId) {
      const auftragNr = `AU-${Date.now().toString().slice(-6)}`
      const fehlendeDaten = [
        !marke_modell && 'Fahrzeugmodell',
        !email && 'E-Mail',
      ].filter(Boolean)
      const hinweis = fehlendeDaten.length
        ? `\n\n⚠️ Noch zu erfragen: ${fehlendeDaten.join(', ')}`
        : ''
      const fahrzeugscheinHinweis = fahrzeugscheinPfad
        ? `\n\n📄 Fahrzeugschein-Foto vorhanden (siehe Termine → Online-Buchung)`
        : ''

      const { error: auftragError } = await supabase.from('auftraege').insert({
        betrieb_id: defaultBetriebId,
        auftrag_nr: auftragNr,
        fahrzeug_id: fahrzeugId,
        kunden_id: kundeId,
        status: 'angenommen',
        arbeiten: leistung,
        geplante_fertigstellung: datum,
        bemerkungen: `Online-Buchung vom ${datum}${uhrzeit ? ' ' + uhrzeit + ' Uhr' : ''}${nachricht ? '\nKundenwunsch: ' + nachricht : ''}${hinweis}${fahrzeugscheinHinweis}`,
      })
      if (auftragError) console.error('Auftrag insert error:', auftragError)
    }
  } catch (e) {
    console.error('Kunde/Fahrzeug/Auftrag error:', e)
  }

  const { error } = await supabase.from('termine').insert({
    betrieb_id: defaultBetriebId,
    titel,
    beschreibung,
    datum,
    uhrzeit: uhrzeit || null,
    dauer_minuten: 60,
    typ: 'online',
    quelle: 'website',
    status: 'offen',
    kunden_id: kundeId,
    notizen: `Online-Buchung von der Website${fahrzeugscheinPfad ? '\nFahrzeugschein-Pfad: ' + fahrzeugscheinPfad : ''}`,
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
