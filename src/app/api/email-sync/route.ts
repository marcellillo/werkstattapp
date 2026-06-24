import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken, fetchUnreadMessages, markMessageAsRead, fetchAttachments } from '@/lib/graph-client'
import { parseEmail, istRechnungsEmail, parseRechnung } from '@/lib/email-parser'

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
    let rechnungenImportiert = 0
    const fehler: string[] = []

    for (const msg of messages) {
      try {
        const inhalt = msg.body.contentType === 'html'
          ? msg.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)
          : msg.body.content.slice(0, 6000)

        const absender = msg.from.emailAddress.address
        const betreff = msg.subject ?? ''

        // ── Rechnungs-E-Mail? ────────────────────────────────
        if (istRechnungsEmail(betreff, inhalt) || msg.hasAttachments) {
          let extrakt: any = null

          // Anhänge prüfen und per Claude analysieren
          if (msg.hasAttachments) {
            const anhaenge = await fetchAttachments(accessToken, msg.id)
            const pdf = anhaenge[0] // erstes PDF/Bild nehmen
            if (pdf) {
              try {
                const { data: keyRow } = await supabase
                  .from('werkstatt_einstellungen').select('wert')
                  .eq('schluessel', 'anthropic_api_key').maybeSingle()
                const apiKey = keyRow?.wert || process.env.ANTHROPIC_API_KEY

                if (apiKey) {
                  const anthropic = new Anthropic({ apiKey })
                  const isPdf = pdf.contentType === 'application/pdf'
                  const mediaType = isPdf ? 'application/pdf' : pdf.contentType as 'image/jpeg' | 'image/png' | 'image/webp'

                  const message = await anthropic.messages.create({
                    model: 'claude-opus-4-8',
                    max_tokens: 2048,
                    messages: [{
                      role: 'user',
                      content: [
                        isPdf
                          ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: pdf.contentBytes } }
                          : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: pdf.contentBytes } },
                        {
                          type: 'text',
                          text: `Analysiere diese Lieferantenrechnung. Antworte NUR mit JSON:
{"lieferant":"Name","rechnungsnummer":"Nr oder null","datum":"YYYY-MM-DD oder null","faellig_am":"YYYY-MM-DD oder null","gesamt":123.45,"positionen":[{"bezeichnung":"Name","teilenummer":"Nr oder null","menge":1,"einzelpreis":9.99,"gesamtpreis":9.99}]}`,
                        },
                      ],
                    }],
                  })

                  const textBlock = message.content.find(b => b.type === 'text')
                  if (textBlock?.type === 'text') {
                    const cleaned = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
                    extrakt = JSON.parse(cleaned)
                  }
                }
              } catch { /* Fallback auf Text-Parsing */ }
            }
          }

          // Fallback: Text-Parsing wenn kein Anhang oder Claude fehlgeschlagen
          if (!extrakt && istRechnungsEmail(betreff, inhalt)) {
            const r = parseRechnung({ absender, betreff, inhalt })
            extrakt = {
              lieferant: msg.from.emailAddress.name || r.lieferant,
              rechnungsnummer: r.rechnungsnummer,
              datum: r.datum,
              faellig_am: r.faelligAm,
              gesamt: r.gesamt,
              positionen: r.positionen,
            }
          }

          if (!extrakt) {
            await markMessageAsRead(accessToken, msg.id)
            continue
          }

          const { data: neu } = await supabase.from('rechnungen').insert({
            lieferant: extrakt.lieferant ?? msg.from.emailAddress.name ?? absender,
            rechnungsnummer: extrakt.rechnungsnummer,
            datum: extrakt.datum,
            faellig_am: extrakt.faellig_am,
            gesamt: extrakt.gesamt,
            absender_email: absender,
            bezahlt: false,
          }).select('id').single()

          if (neu && extrakt.positionen?.length > 0) {
            await supabase.from('rechnung_positionen').insert(
              extrakt.positionen.map((p: any) => ({
                rechnung_id: neu.id,
                bezeichnung: p.bezeichnung,
                teilenummer: p.teilenummer ?? null,
                menge: p.menge ?? 1,
                einzelpreis: p.einzelpreis ?? null,
                gesamtpreis: p.gesamtpreis ?? null,
              }))
            )
          }
          rechnungenImportiert++
          await markMessageAsRead(accessToken, msg.id)
          continue
        }

        // ── Teile-Status-E-Mail ──────────────────────────────
        const parsed = parseEmail({ absender, betreff, inhalt })

        // Nur E-Mails mit erkennbarem Status verarbeiten (Lieferant egal)
        if ((parsed.status as string) === 'unbekannt') {
          await markMessageAsRead(accessToken, msg.id)
          continue
        }

        // Lieferantenname aus Absender ableiten falls unbekannt
        if (parsed.lieferant === 'Unbekannt') {
          const absenderName = msg.from.emailAddress.name || absender.split('@')[1]?.split('.')[0] || 'Lieferant'
          parsed.lieferant = absenderName
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
      rechnungenImportiert,
      fehler,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
