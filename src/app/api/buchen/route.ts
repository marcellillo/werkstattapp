export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { initWebPush } from '@/lib/push-vapid'
import { timingSafeEqual } from 'crypto'
import { clientIp, rateLimit } from '@/lib/rate-limit'

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
  // HINWEIS: Das Formular der Website sendet dieses Secret aus dem Browser -> es ist nur ein Spam-Filter,
  // kein echter Schutz. Den eigentlichen Schutz bilden Rate-Limits, strenge Prüfung und Größengrenzen.
  const erwartet = process.env.BOOKING_SECRET ?? ''
  const gesendet = req.headers.get('x-booking-secret') ?? ''
  const secretOk = erwartet.length > 0 && gesendet.length === erwartet.length && timingSafeEqual(Buffer.from(gesendet), Buffer.from(erwartet))
  if (!secretOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  }

  // Missbrauchsschutz: pro IP und insgesamt begrenzen (jede Anfrage legt Kunde, Fahrzeug, Auftrag, Termin an)
  const limitIp = await rateLimit(`buchen:ip:${clientIp(req)}`, 6, 3600)
  if (limitIp) return NextResponse.json(await limitIp.json(), { status: 429, headers: { ...headers, 'Retry-After': '3600' } })
  const limitAlle = await rateLimit('buchen:alle', 300, 3600)
  if (limitAlle) return NextResponse.json(await limitAlle.json(), { status: 429, headers: { ...headers, 'Retry-After': '3600' } })

  // Der Body darf nicht riesig sein (Vercel erlaubt ohnehin max. ~4,5 MB)
  if (Number(req.headers.get('content-length') ?? 0) > 6_000_000) {
    return NextResponse.json({ error: 'Anfrage zu groß' }, { status: 413, headers })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers })
  }

  // Honeypot: ein verstecktes Feld, das Menschen nie ausfüllen -> Bot, still "erfolgreich" beantworten
  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ success: true }, { headers })
  }

  // Nur Texte mit begrenzter Länge und ohne Steuerzeichen akzeptieren
  const t = (v: unknown, max: number) =>
    typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max) : ''
  const vorname = t(body.vorname, 80)
  const nachname = t(body.nachname, 80)
  const telefon = t(body.telefon, 40)
  const email = t(body.email, 120)
  const kennzeichen = t(body.kennzeichen, 20)
  const marke_modell = t(body.marke_modell, 100)
  const leistung = t(body.leistung, 300)
  const datum = t(body.datum, 10)
  const uhrzeit = t(body.uhrzeit, 5)
  const nachricht = t(body.nachricht, 1500)
  const { fahrzeugschein_foto, fahrzeugschein_dateiname } = body

  // Telefon ODER E-Mail genügt (das Formular der Website verlangt nur die E-Mail)
  if (!vorname || !nachname || !leistung || !datum || (!telefon && !email)) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400, headers })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400, headers })
  }
  const datumGueltig = /^\d{4}-\d{2}-\d{2}$/.test(datum) && !Number.isNaN(Date.parse(datum + 'T00:00:00Z'))
  const tageBisTermin = datumGueltig ? (Date.parse(datum + 'T00:00:00Z') - Date.now()) / 86_400_000 : NaN
  if (!datumGueltig || tageBisTermin < -2 || tageBisTermin > 400) {
    return NextResponse.json({ error: 'Ungültiges Datum' }, { status: 400, headers })
  }
  if (uhrzeit && !/^([01]\d|2[0-3]):[0-5]\d$/.test(uhrzeit)) {
    return NextResponse.json({ error: 'Ungültige Uhrzeit' }, { status: 400, headers })
  }

  // ── Fahrzeugschein-Foto aus der Online-Anfrage dauerhaft in Supabase Storage sichern ──
  // (nutzt denselben privaten "fahrzeugbrief"-Bucket wie die manuell hochgeladenen
  // Fahrzeugbriefe; der Service-Role-Client umgeht Storage-Policies, kein Setup nötig)
  let fahrzeugscheinPfad: string | null = null
  const ERLAUBTE_BILDER: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' }
  if (typeof fahrzeugschein_foto === 'string' && fahrzeugschein_foto.length <= 6_000_000) {
    try {
      const match = fahrzeugschein_foto.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/)
      const ext = match ? ERLAUBTE_BILDER[match[1].toLowerCase()] : undefined
      if (match && ext) {
        const mime = match[1].toLowerCase()
        const buffer = Buffer.from(match[2], 'base64')
        if (buffer.length > 0 && buffer.length <= 4_500_000) {
          const basis = String(fahrzeugschein_dateiname || 'fahrzeugschein').replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'fahrzeugschein'
          const path = `online-anfragen/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${basis}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from('fahrzeugbrief')
            .upload(path, buffer, { contentType: mime, upsert: false })
          if (!uploadError) fahrzeugscheinPfad = path
          else console.error('Fahrzeugschein-Upload error:', uploadError)
        }
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
  let auftragId: string | null = null
  try {
    let existing: any = null
    const kzNorm = kennzeichen?.toUpperCase().replace(/\s+/g, '') ?? null

    if (telefon) {
      const { data } = await supabase.from('kunden').select('id').eq('betrieb_id', defaultBetriebId).eq('telefon', telefon).limit(1).maybeSingle()
      existing = data
    }
    if (!existing && email) {
      const { data } = await supabase.from('kunden').select('id').eq('betrieb_id', defaultBetriebId).eq('email', email).limit(1).maybeSingle()
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
      const { data: existingFz } = await supabase.from('fahrzeuge').select('id').eq('betrieb_id', defaultBetriebId).eq('kennzeichen', kzNorm).limit(1).maybeSingle()
      if (existingFz) {
        fahrzeugId = existingFz.id
        // Kunden-Verknüpfung aktualisieren falls noch nicht gesetzt
        if (kundeId) await supabase.from('fahrzeuge').update({ kunden_id: kundeId }).eq('id', fahrzeugId).eq('betrieb_id', defaultBetriebId).is('kunden_id', null)
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

      const { data: neuerAuftrag, error: auftragError } = await supabase.from('auftraege').insert({
        betrieb_id: defaultBetriebId,
        auftrag_nr: auftragNr,
        fahrzeug_id: fahrzeugId,
        kunden_id: kundeId,
        status: 'angenommen',
        arbeiten: leistung,
        geplante_fertigstellung: datum,
        bemerkungen: `Online-Buchung vom ${datum}${uhrzeit ? ' ' + uhrzeit + ' Uhr' : ''}${nachricht ? '\nKundenwunsch: ' + nachricht : ''}${hinweis}${fahrzeugscheinHinweis}`,
      }).select('id').single()
      if (auftragError) console.error('Auftrag insert error:', auftragError)
      if (neuerAuftrag) auftragId = neuerAuftrag.id
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
    auftrag_id: auftragId,
    notizen: `Online-Buchung von der Website${fahrzeugscheinPfad ? '\nFahrzeugschein-Pfad: ' + fahrzeugscheinPfad : ''}`,
  })

  if (error) {
    console.error('Termin insert error:', error)
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500, headers })
  }

  // Push-Benachrichtigung an alle abonnierten Geräte senden
  try {
    if (!initWebPush()) throw new Error('Push nicht konfiguriert (VAPID)')
    // Nur Mitarbeiter des Ziel-Betriebs benachrichtigen, nicht alle abonnierten
    // Geraete app-weit (push_subscriptions ist pro user_id, nicht pro Betrieb).
    const { data: betriebMitarbeiter } = await supabase.from('betrieb_users').select('profile_id').eq('betrieb_id', defaultBetriebId)
    const mitarbeiterIds = (betriebMitarbeiter ?? []).map(m => m.profile_id)
    const { data: subs } = mitarbeiterIds.length
      ? await supabase.from('push_subscriptions').select('*').in('user_id', mitarbeiterIds)
      : { data: [] as any[] }
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
