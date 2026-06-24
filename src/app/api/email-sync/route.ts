import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken, fetchUnreadMessages, markMessageAsRead } from '@/lib/graph-client'
import { parseEmail } from '@/lib/email-parser'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: rows } = await supabase
    .from('werkstatt_einstellungen')
    .select('schluessel, wert')

  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  const { graph_client_id, graph_tenant_id, graph_client_secret, graph_refresh_token } = cfg

  if (!graph_refresh_token) {
    return NextResponse.json(
      { error: 'Microsoft-Konto noch nicht verbunden. Bitte unter Einstellungen → E-Mail-Integration verbinden.' },
      { status: 400 },
    )
  }

  try {
    // Frisches Access Token holen
    const { accessToken, refreshToken: newRefresh } = await refreshAccessToken(
      graph_refresh_token, graph_client_id, graph_tenant_id, graph_client_secret,
    )

    // Refresh Token aktualisieren falls neu
    if (newRefresh !== graph_refresh_token) {
      await supabase.from('werkstatt_einstellungen')
        .upsert({ schluessel: 'graph_refresh_token', wert: newRefresh }, { onConflict: 'schluessel' })
    }

    const messages = await fetchUnreadMessages(accessToken)

    let neuErstellt = 0
    let statusAktualisiert = 0
    const fehler: string[] = []

    for (const msg of messages) {
      try {
        const inhalt = msg.body.contentType === 'html'
          ? msg.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)
          : msg.body.content.slice(0, 6000)

        const parsed = parseEmail({
          absender: msg.from.emailAddress.address,
          betreff: msg.subject ?? '',
          inhalt,
        })

        // Nur bekannte Lieferanten verarbeiten
        if (parsed.lieferant === 'Unbekannt' || parsed.status === 'unbekannt') {
          continue
        }

        // Auftrag finden
        let auftragId: string | null = null
        if (parsed.auftragsnummer) {
          const { data: a } = await supabase.from('auftraege').select('id')
            .ilike('auftrag_nr', `%${parsed.auftragsnummer}%`).single()
          if (a) auftragId = a.id
        }
        if (!auftragId && parsed.kennzeichen) {
          const { data: fz } = await supabase.from('fahrzeuge').select('id')
            .ilike('kennzeichen', `%${parsed.kennzeichen}%`).single()
          if (fz) {
            const { data: a } = await supabase.from('auftraege').select('id')
              .eq('fahrzeug_id', fz.id).not('status', 'in', '("fertig","ausgeliefert")')
              .order('erstellt_am', { ascending: false }).limit(1).single()
            if (a) auftragId = a.id
          }
        }

        // E-Mail protokollieren
        const { data: protokoll } = await supabase.from('email_protokoll').insert({
          auftrag_id: auftragId,
          absender: msg.from.emailAddress.address,
          betreff: msg.subject,
          inhalt,
          empfangen_am: msg.receivedDateTime,
          erkannter_status: parsed.status,
          verarbeitet: false,
        }).select('id').single()

        if (auftragId && (parsed.status as string) !== 'unbekannt') {
          const statusReihenfolge = ['nicht_bestellt', 'bestellt', 'unterwegs', 'geliefert', 'eingebaut']

          for (const teil of parsed.teile) {
            const { data: vorhanden } = await supabase.from('ersatzteile').select('id, status')
              .eq('auftrag_id', auftragId)
              .or(teil.teilenummer
                ? `teilenummer.eq.${teil.teilenummer},bezeichnung.ilike.%${teil.bezeichnung}%`
                : `bezeichnung.ilike.%${teil.bezeichnung}%`)
              .limit(1).single()

            if (vorhanden) {
              const aktuellIdx = statusReihenfolge.indexOf(vorhanden.status)
              const neuIdx = statusReihenfolge.indexOf(parsed.status)
              if (neuIdx > aktuellIdx) {
                await supabase.from('ersatzteile').update({
                  status: parsed.status,
                  ...(parsed.status === 'geliefert' ? { geliefert_am: new Date().toISOString().split('T')[0] } : {}),
                }).eq('id', vorhanden.id)
                statusAktualisiert++
              }
            } else if (parsed.status === 'bestellt' || parsed.status === 'unterwegs') {
              await supabase.from('ersatzteile').insert({
                auftrag_id: auftragId,
                bezeichnung: teil.bezeichnung,
                teilenummer: teil.teilenummer,
                lieferant: parsed.lieferant,
                menge: teil.menge,
                einzelpreis: teil.einzelpreis,
                status: parsed.status,
                bestellt_am: parsed.status === 'bestellt' ? new Date().toISOString().split('T')[0] : undefined,
              })
              neuErstellt++
            }
          }

          if (parsed.status === 'geliefert') {
            await supabase.from('benachrichtigungen').insert({
              titel: `Teile eingetroffen: ${parsed.lieferant}`,
              nachricht: `Lieferung von ${parsed.lieferant} eingetroffen. ${parsed.teile.map(t => t.bezeichnung).join(', ')}`,
              typ: 'teil_eingetroffen',
              auftrag_id: auftragId,
              gelesen: false,
            })
          }

          if (protokoll) {
            await supabase.from('email_protokoll').update({ verarbeitet: true }).eq('id', protokoll.id)
          }
        }

        await markMessageAsRead(accessToken, msg.id)
      } catch (e: any) {
        fehler.push(`${msg.subject}: ${e.message}`)
      }
    }

    await supabase.from('werkstatt_einstellungen').upsert(
      { schluessel: 'letzter_email_sync', wert: new Date().toISOString() },
      { onConflict: 'schluessel' }
    )

    return NextResponse.json({
      erfolg: true,
      emailsGeprueft: messages.length,
      neuErstellt,
      statusAktualisiert,
      fehler,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
