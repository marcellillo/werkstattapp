export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken, fetchUnreadMessages, markMessageAsRead, fetchAttachments } from '@/lib/graph-client'

// Claude analysiert eine E-Mail vollständig (Text + alle Anhänge)
async function analysiereEmailMitClaude(
  anthropic: Anthropic,
  msg: { subject: string; from: { emailAddress: { address: string; name: string } }; body: { content: string; contentType: string }; hasAttachments: boolean },
  anhaenge: { name: string; contentType: string; contentBytes: string }[],
): Promise<EmailAnalyse> {
  const absenderName = msg.from.emailAddress.name || msg.from.emailAddress.address
  const absenderEmail = msg.from.emailAddress.address
  const betreff = msg.subject ?? ''
  const bodyText = msg.body.contentType === 'html'
    ? msg.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
    : msg.body.content.slice(0, 8000)

  const systemPrompt = `Du bist ein KFZ-Werkstatt-Assistent. Analysiere eingehende E-Mails von Lieferanten und extrahiere strukturierte Daten.
Antworte NUR mit validem JSON, kein anderer Text.`

  const userPrompt = `Analysiere diese E-Mail von einem Kfz-Teilelieferanten:

Absender: ${absenderName} <${absenderEmail}>
Betreff: ${betreff}
Inhalt:
${bodyText}

Extrahiere ALLES und antworte mit diesem JSON-Schema:
{
  "typ": "rechnung" | "lieferstatus" | "bestellbestaetigung" | "sonstiges",
  "lieferant": "Firmenname des Absenders",
  "status": "bestellt" | "unterwegs" | "geliefert" | "unbekannt",
  "auftragsnummer": "AUF-XXXX-XXX oder null",
  "kennzeichen": "KFZ-Kennzeichen oder null",
  "teile": [
    {
      "bezeichnung": "Artikelname",
      "teilenummer": "Artikelnummer oder null",
      "menge": 1,
      "einzelpreis": 9.99
    }
  ],
  "rechnung": {
    "rechnungsnummer": "Nr oder null",
    "datum": "YYYY-MM-DD oder null",
    "faellig_am": "YYYY-MM-DD oder null",
    "gesamt": 123.45
  } | null
}

Wichtig:
- Extrahiere ALLE Teile/Artikel aus dem Text
- Bei Versandbestätigungen: status="unterwegs"
- Bei Lieferbestätigungen/Zustellungen: status="geliefert"
- Bei Bestellbestätigungen: status="bestellt"
- Erkenne Rechnungen auch ohne explizites Wort "Rechnung"`

  const contentBlocks: Anthropic.MessageParam['content'] = []

  // Alle Anhänge hinzufügen
  for (const anhang of anhaenge) {
    try {
      if (anhang.contentType === 'application/pdf') {
        contentBlocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: anhang.contentBytes },
          title: anhang.name,
        } as any)
      } else if (anhang.contentType?.startsWith('image/')) {
        const mediaType = anhang.contentType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: anhang.contentBytes },
        })
      }
    } catch { /* Anhang überspringen wenn kaputt */ }
  }

  contentBlocks.push({ type: 'text', text: userPrompt })

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: contentBlocks }],
  })

  const textBlock = message.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('Keine Antwort von Claude')

  const cleaned = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as EmailAnalyse
}

interface EmailAnalyse {
  typ: 'rechnung' | 'lieferstatus' | 'bestellbestaetigung' | 'sonstiges'
  lieferant: string
  status: 'bestellt' | 'unterwegs' | 'geliefert' | 'unbekannt'
  auftragsnummer: string | null
  kennzeichen: string | null
  teile: { bezeichnung: string; teilenummer: string | null; menge: number; einzelpreis: number | null }[]
  rechnung: {
    rechnungsnummer: string | null
    datum: string | null
    faellig_am: string | null
    gesamt: number | null
  } | null
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: rows } = await supabase.from('werkstatt_einstellungen').select('schluessel, wert')
  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  const { graph_client_id, graph_tenant_id, graph_client_secret, graph_refresh_token } = cfg
  if (!graph_refresh_token) {
    return NextResponse.json(
      { error: 'Microsoft-Konto noch nicht verbunden. Bitte unter Einstellungen → E-Mail-Integration verbinden.' },
      { status: 400 },
    )
  }

  const apiKey = cfg.anthropic_api_key || process.env.ANTHROPIC_API_KEY
  const anthropic = apiKey ? new Anthropic({ apiKey }) : null

  try {
    const { accessToken, refreshToken: newRefresh } = await refreshAccessToken(
      graph_refresh_token, graph_client_id, graph_tenant_id, graph_client_secret,
    )
    if (newRefresh !== graph_refresh_token) {
      await supabase.from('werkstatt_einstellungen')
        .upsert({ schluessel: 'graph_refresh_token', wert: newRefresh }, { onConflict: 'schluessel' })
    }

    const messages = await fetchUnreadMessages(accessToken, 50)

    let neuErstellt = 0
    let statusAktualisiert = 0
    let rechnungenImportiert = 0
    const fehler: string[] = []
    const verarbeitet: string[] = []

    for (const msg of messages) {
      try {
        // Alle Anhänge laden (PDFs + Bilder)
        const anhaenge = msg.hasAttachments
          ? await fetchAttachments(accessToken, msg.id)
          : []

        let analyse: EmailAnalyse | null = null

        // Claude analysiert E-Mail + alle Anhänge
        if (anthropic) {
          try {
            analyse = await analysiereEmailMitClaude(anthropic, msg, anhaenge)
          } catch (e: any) {
            fehler.push(`Claude-Fehler bei "${msg.subject}": ${e.message}`)
          }
        }

        // Fallback: Basis-Regex wenn Claude nicht verfügbar
        if (!analyse) {
          const inhalt = msg.body.contentType === 'html'
            ? msg.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            : msg.body.content
          const { parseEmail, istRechnungsEmail, parseRechnung } = await import('@/lib/email-parser')
          const parsed = parseEmail({ absender: msg.from.emailAddress.address, betreff: msg.subject ?? '', inhalt })
          const istRechnung = istRechnungsEmail(msg.subject ?? '', inhalt) || msg.hasAttachments
          let rechnung = null
          if (istRechnung) {
            const r = parseRechnung({ absender: msg.from.emailAddress.address, betreff: msg.subject ?? '', inhalt })
            rechnung = { rechnungsnummer: r.rechnungsnummer, datum: r.datum, faellig_am: r.faelligAm, gesamt: r.gesamt }
          }
          analyse = {
            typ: istRechnung ? 'rechnung' : 'lieferstatus',
            lieferant: parsed.lieferant !== 'Unbekannt' ? parsed.lieferant : (msg.from.emailAddress.name || msg.from.emailAddress.address),
            status: parsed.status,
            auftragsnummer: parsed.auftragsnummer,
            kennzeichen: parsed.kennzeichen,
            teile: parsed.teile,
            rechnung,
          }
        }

        if (!analyse) {
          await markMessageAsRead(accessToken, msg.id)
          continue
        }

        // ── Rechnung importieren ────────────────────────────
        if (analyse.typ === 'rechnung' && analyse.rechnung) {
          const r = analyse.rechnung
          const { data: neu } = await supabase.from('rechnungen').insert({
            lieferant: analyse.lieferant,
            rechnungsnummer: r.rechnungsnummer,
            datum: r.datum,
            faellig_am: r.faellig_am,
            gesamt: r.gesamt,
            absender_email: msg.from.emailAddress.address,
            bezahlt: false,
          }).select('id').single()

          if (neu && analyse.teile.length > 0) {
            await supabase.from('rechnung_positionen').insert(
              analyse.teile.map(t => ({
                rechnung_id: neu.id,
                bezeichnung: t.bezeichnung,
                teilenummer: t.teilenummer ?? null,
                menge: t.menge ?? 1,
                einzelpreis: t.einzelpreis ?? null,
                gesamtpreis: t.einzelpreis && t.menge ? t.einzelpreis * t.menge : null,
              }))
            )
          }
          rechnungenImportiert++
          verarbeitet.push(`Rechnung: ${analyse.lieferant}`)
          await markMessageAsRead(accessToken, msg.id)
          continue
        }

        // ── Teile-Status aktualisieren ──────────────────────
        if (analyse.status === 'unbekannt' && analyse.typ === 'sonstiges') {
          // Nicht relevante E-Mail → trotzdem als gelesen markieren
          await markMessageAsRead(accessToken, msg.id)
          continue
        }

        // Auftrag suchen
        let auftragId: string | null = null
        if (analyse.auftragsnummer) {
          const { data: a } = await supabase.from('auftraege').select('id')
            .ilike('auftrag_nr', `%${analyse.auftragsnummer}%`).maybeSingle()
          if (a) auftragId = a.id
        }
        if (!auftragId && analyse.kennzeichen) {
          const { data: fz } = await supabase.from('fahrzeuge').select('id')
            .ilike('kennzeichen', `%${analyse.kennzeichen}%`).maybeSingle()
          if (fz) {
            const { data: a } = await supabase.from('auftraege').select('id')
              .eq('fahrzeug_id', fz.id)
              .not('status', 'in', '("fertig","ausgeliefert","storniert")')
              .order('erstellt_am', { ascending: false })
              .limit(1).maybeSingle()
            if (a) auftragId = a.id
          }
        }

        // E-Mail protokollieren
        const inhaltKurz = msg.body.contentType === 'html'
          ? msg.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)
          : msg.body.content.slice(0, 3000)

        const { data: protokoll } = await supabase.from('email_protokoll').insert({
          auftrag_id: auftragId,
          absender: msg.from.emailAddress.address,
          betreff: msg.subject,
          inhalt: inhaltKurz,
          empfangen_am: msg.receivedDateTime,
          erkannter_status: analyse.status,
          verarbeitet: false,
        }).select('id').maybeSingle()

        // Teile-Status aktualisieren wenn Auftrag gefunden
        if (auftragId && analyse.status !== 'unbekannt' && analyse.teile.length > 0) {
          const statusReihenfolge = ['nicht_bestellt', 'bestellt', 'unterwegs', 'geliefert', 'eingebaut']

          for (const teil of analyse.teile) {
            if (!teil.bezeichnung || teil.bezeichnung === 'Siehe E-Mail') continue

            // Vorhandenes Teil suchen
            let query = supabase.from('ersatzteile').select('id, status').eq('auftrag_id', auftragId)
            if (teil.teilenummer) {
              query = query.or(`teilenummer.eq.${teil.teilenummer},bezeichnung.ilike.%${teil.bezeichnung.slice(0, 20)}%`)
            } else {
              query = query.ilike('bezeichnung', `%${teil.bezeichnung.slice(0, 20)}%`)
            }
            const { data: vorhanden } = await query.limit(1).maybeSingle()

            if (vorhanden) {
              const aktuellIdx = statusReihenfolge.indexOf(vorhanden.status)
              const neuIdx = statusReihenfolge.indexOf(analyse.status)
              if (neuIdx > aktuellIdx) {
                await supabase.from('ersatzteile').update({
                  status: analyse.status,
                  lieferant: analyse.lieferant,
                  ...(analyse.status === 'geliefert' ? { geliefert_am: new Date().toISOString().split('T')[0] } : {}),
                }).eq('id', vorhanden.id)
                statusAktualisiert++
              }
            } else if (analyse.status === 'bestellt' || analyse.status === 'unterwegs') {
              // Neues Teil anlegen
              await supabase.from('ersatzteile').insert({
                auftrag_id: auftragId,
                bezeichnung: teil.bezeichnung,
                teilenummer: teil.teilenummer,
                lieferant: analyse.lieferant,
                menge: teil.menge ?? 1,
                einzelpreis: teil.einzelpreis,
                status: analyse.status,
                bestellt_am: analyse.status === 'bestellt' ? new Date().toISOString().split('T')[0] : null,
              })
              neuErstellt++
            }
          }

          // Benachrichtigung bei Lieferung
          if (analyse.status === 'geliefert') {
            await supabase.from('benachrichtigungen').insert({
              titel: `Teile eingetroffen: ${analyse.lieferant}`,
              nachricht: `Lieferung von ${analyse.lieferant} eingetroffen. ${analyse.teile.map(t => t.bezeichnung).join(', ')}`,
              typ: 'teil_eingetroffen',
              auftrag_id: auftragId,
              gelesen: false,
            })
          }

          if (protokoll) {
            await supabase.from('email_protokoll').update({ verarbeitet: true }).eq('id', protokoll.id)
          }
          verarbeitet.push(`${analyse.lieferant}: ${analyse.teile.map(t => t.bezeichnung).join(', ')}`)
        }

        await markMessageAsRead(accessToken, msg.id)
      } catch (e: any) {
        fehler.push(`"${msg.subject}": ${e.message}`)
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
      verarbeitet,
      fehler,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
