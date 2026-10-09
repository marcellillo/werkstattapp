export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { ladeKvaSummen } from '@/lib/kva-summen'
import { pushAnBetrieb } from '@/lib/push-betrieb'
import { serverFehler } from '@/lib/api-fehler'

const TOKEN = /^[0-9a-f]{64}$/
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max) : '')
const euro = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

// POST /api/freigabe/<token>  { aktion: 'freigeben' | 'rueckfrage', name, nachricht }
// ÖFFENTLICH (kein Login): Der Kunde gibt seinen Kostenvoranschlag frei oder meldet eine Rückfrage/Ablehnung.
// Berechtigung = das geheime Token im Link. Begrenzung pro IP und pro Token gegen Missbrauch.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!TOKEN.test(token)) return NextResponse.json({ error: 'Link ungültig' }, { status: 404 })

  const limitIp = await rateLimit(`freigabe-ip:${clientIp(req)}`, 20, 600)
  if (limitIp) return limitIp
  const limitToken = await rateLimit(`freigabe-token:${token.slice(0, 16)}`, 30, 3600)
  if (limitToken) return limitToken

  const body = await req.json().catch(() => ({}))
  const aktion = body?.aktion === 'freigeben' ? 'freigeben' : body?.aktion === 'rueckfrage' ? 'rueckfrage' : null
  const name = text(body?.name, 120)
  const nachricht = text(body?.nachricht, 1000)
  if (!aktion) return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
  if (aktion === 'freigeben' && name.length < 2) return NextResponse.json({ error: 'Bitte Ihren Namen eintragen.' }, { status: 400 })
  if (aktion === 'rueckfrage' && nachricht.length < 3) return NextResponse.json({ error: 'Bitte kurz beschreiben, was unklar ist.' }, { status: 400 })

  try {
    const admin = createAdminClient()
    const { data: t } = await admin.from('kva_freigabe_tokens').select('kva_id').eq('token', token).maybeSingle()
    if (!t) return NextResponse.json({ error: 'Link ungültig' }, { status: 404 })
    const { data: kva } = await admin.from('kostenvoranschlaege')
      .select('id, betrieb_id, auftrag_id, fahrzeug_id, status, rechnung_id, ersatzteile_modus, ersatzteile_festpreis, freigegeben_am')
      .eq('id', t.kva_id).maybeSingle()
    if (!kva) return NextResponse.json({ error: 'Link ungültig' }, { status: 404 })
    if (kva.rechnung_id) return NextResponse.json({ error: 'Dieser Kostenvoranschlag wurde bereits abgerechnet.' }, { status: 409 })
    if (kva.status === 'akzeptiert' && aktion === 'freigeben') return NextResponse.json({ erfolg: true, bereits: true })

    const summen = await ladeKvaSummen(admin, kva as any)
    const { data: fz } = kva.fahrzeug_id ? await admin.from('fahrzeuge').select('marke, modell, kennzeichen').eq('id', kva.fahrzeug_id).maybeSingle() : { data: null as any }
    const fahrzeug = [fz?.marke, fz?.modell, fz?.kennzeichen && `(${fz.kennzeichen})`].filter(Boolean).join(' ') || 'Fahrzeug'

    if (aktion === 'freigeben') {
      const { error } = await admin.from('kostenvoranschlaege').update({
        status: 'akzeptiert', freigegeben_am: new Date().toISOString(), freigegeben_name: name,
        freigegeben_betrag: summen.brutto, freigabe_hinweis: nachricht || null,
      }).eq('id', kva.id)
      if (error) throw error
    } else if (kva.status !== 'akzeptiert') {
      // Eine bereits erteilte Freigabe bleibt bestehen; die Nachricht erreicht die Werkstatt trotzdem
      const { error } = await admin.from('kostenvoranschlaege').update({ status: 'abgelehnt', freigabe_hinweis: nachricht, freigegeben_name: name || null }).eq('id', kva.id)
      if (error) throw error
    }

    // Werkstatt benachrichtigen (Glocke + Push); Fehler hier dürfen die Antwort an den Kunden nicht verhindern
    const titel = aktion === 'freigeben' ? '✅ Kostenvoranschlag freigegeben' : '❓ Rückfrage zum Kostenvoranschlag'
    const meldung = aktion === 'freigeben'
      ? `${name} hat den Kostenvoranschlag für ${fahrzeug} freigegeben (${euro(summen.brutto)} brutto).`
      : `${name ? name + ': ' : ''}${nachricht} — ${fahrzeug}`
    await admin.from('benachrichtigungen').insert({
      betrieb_id: kva.betrieb_id, benutzer_id: null, typ: 'info', titel, nachricht: meldung.slice(0, 500), auftrag_id: kva.auftrag_id ?? null, gelesen: false,
    })
    await pushAnBetrieb(kva.betrieb_id, { title: titel, body: meldung, url: kva.auftrag_id ? `/fahrzeuge/${kva.auftrag_id}` : '/dashboard', tag: 'freigabe' })

    return NextResponse.json({ erfolg: true })
  } catch (e) {
    return serverFehler(e, 'freigabe')
  }
}
