export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { serverFehler } from '@/lib/api-fehler'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rlAntwort = await rateLimit(`fahrzeugschein-scan:${user.id}`, 30, 600)
  if (rlAntwort) return rlAntwort

  const { data: userBetrieb } = await supabase
    .from('betrieb_users')
    .select('betrieb_id')
    .eq('profile_id', user.id)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle()
  const betriebId = userBetrieb?.betrieb_id
  if (!betriebId) return NextResponse.json({ error: 'Kein Betrieb zugeordnet' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('bild') as File | null
  if (!file) return NextResponse.json({ error: 'Kein Bild übermittelt' }, { status: 400 })

  const adminSupabase = createAdminClient()
  const { data: rows } = await adminSupabase.from('betrieb_einstellungen').select('schluessel, wert').eq('betrieb_id', betriebId)
  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  const apiKey = cfg.anthropic_api_key || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein Claude API-Key konfiguriert' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Dies ist ein deutsches Fahrzeugdokument (Zulassungsbescheinigung Teil I oder alter Fahrzeugschein).
Extrahiere alle Fahrzeugdaten und antworte NUR mit validem JSON, kein anderer Text.

Felder im deutschen Fahrzeugschein:
- A = Kennzeichen
- B = Datum der Erstzulassung (TT.MM.JJJJ)
- D.1 = Marke
- D.2/D.3 = Modell / Handelsbezeichnung
- E = Fahrgestellnummer (FIN/VIN, 17 Zeichen)
- P.1 = Hubraum in cm³
- P.2 = Leistung in kW
- J = Fahrzeugklasse (PKW, LKW etc.)
- C.1.1 = Name (oder Firma) des Halters, C.1.2 = Vorname des Halters, C.1.3 = Anschrift des Halters (Straße mit Hausnummer, PLZ, Ort)
- HSN = Hersteller-Schlüssel-Nummer (meist 4 Ziffern, z.B. "0146")
- TSN = Typ-Schlüssel-Nummer (meist 3 Ziffern, z.B. "BAA")
- Fahrzeugtyp/Modellcode = z.B. W205 (Mercedes C-Klasse), F31 (BMW 3er), MQB (VW Plattform)

Antworte mit exakt diesem JSON:
{
  "kennzeichen": "WOB-XX 123",
  "marke": "Volkswagen",
  "modell": "Golf 1.6 TDI",
  "fahrgestellnummer": "WVWZZZ1KZAW123456",
  "baujahr": 2010,
  "hubraum": 1598,
  "leistung_kw": 77,
  "erstzulassung": "15.03.2010",
  "hsn": "0146",
  "tsn": "BAA",
  "fahrzeugtyp": "W205",
  "halter": { "vorname": "Max", "nachname": "Mustermann", "firma": null, "strasse": "Musterstraße 12", "plz": "38350", "ort": "Helmstedt" }
}

Regeln:
- Nur Werte die klar lesbar sind eintragen, sonst null
- kennzeichen in Großbuchstaben mit Bindestrich (z.B. "WOB-XX 123")
- baujahr als vierstellige Zahl aus Erstzulassungsdatum
- fahrzeugtyp aus HSN/TSN oder Dokumentfeld extrahieren (z.B. W205 für Mercedes C-Klasse)
- Wenn HSN/TSN bekannt sind: versuche bekannten Fahrzeugtyp zu bestimmen
- Halter: nur Werte aus C.1.1–C.1.3, die klar lesbar sind, sonst null. Bei Privatpersonen steht in C.1.1 der Nachname und in C.1.2 der Vorname.
- Ist C.1.1 eine Firma (z. B. GmbH, UG, AG, KG, OHG, GbR, e.K., e.V., Autohaus, Leasing), dann den Namen in "firma" eintragen und "nachname"/"vorname" auf null setzen.
- strasse enthält Straße UND Hausnummer, plz ist fünfstellig, ort ohne PLZ
- Wenn kein Fahrzeugdokument erkennbar: alle Felder null`,
          },
        ],
      }],
    })

    const text = (message.content[0] as any).text?.trim() ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Dokument konnte nicht ausgelesen werden' }, { status: 422 })

    const daten = JSON.parse(jsonMatch[0])
    // Halterdaten: nur kurze Texte zulassen (wandern später in Formularfelder und die Kundendatenbank)
    const t = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : null)
    const h = daten.halter && typeof daten.halter === 'object' ? daten.halter : {}
    const plz = typeof h.plz === 'string' || typeof h.plz === 'number' ? String(h.plz).replace(/\D/g, '').slice(0, 5) : ''
    daten.halter = {
      vorname: t(h.vorname, 80), nachname: t(h.nachname, 80), firma: t(h.firma, 120),
      strasse: t(h.strasse, 120), plz: plz.length === 5 ? plz : null, ort: t(h.ort, 80),
    }
    return NextResponse.json({ daten })
  } catch (e: any) {
    return serverFehler(e, 'fahrzeugschein-scan')
  }
}
