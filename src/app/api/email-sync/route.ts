export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken, fetchUnreadMessages, markMessageAsRead, fetchAttachments } from '@/lib/graph-client'

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

async function analysiereEmailMitClaude(
  anthropic: Anthropic,
  msg: { subject: string; from: { emailAddress: { address: string; name: string } }; body: { content: string; contentType: string } },
  anhaenge: { name: string; contentType: string; contentBytes: string }[],
): Promise<EmailAnalyse> {
  const absenderName = msg.from.emailAddress.name || msg.from.emailAddress.address
  const absenderEmail = msg.from.emailAddress.address
  const betreff = msg.subject ?? ''
  const bodyText = msg.body.contentType === 'html'
    ? msg.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
    : msg.body.content.slice(0, 8000)

  const systemPrompt = `Du bist ein KFZ-Werkstatt-Assistent. Analysiere E-Mails von Lieferanten und extrahiere strukturierte Daten. Antworte NUR mit validem JSON, kein anderer Text.`

  const hatAnhaenge = anhaenge.length > 0

  const prompt = hatAnhaenge
    ? `Lies den/die beigefuegten Anhang/Anhaenge (PDF oder Bild) und extrahiere alle Daten daraus.
Der E-Mail-Text dient nur als Kontext (Absender, Betreff).

Von: ${absenderName} <${absenderEmail}>
Betreff: ${betreff}

Extrahiere aus dem Anhang und antworte mit exakt diesem JSON:
{
  "typ": "rechnung",
  "lieferant": "Firmenname aus dem Briefkopf des Anhangs",
  "status": "unbekannt",
  "auftragsnummer": null,
  "kennzeichen": null,
  "teile": [
    { "bezeichnung": "Vollstaendiger Artikelname", "teilenummer": "OE/Artikel-Nr oder null", "menge": 1, "einzelpreis": 9.99 }
  ],
  "rechnung": {
    "rechnungsnummer": "Rechnungsnummer aus Anhang oder null",
    "datum": "YYYY-MM-DD oder null",
    "faellig_am": "YYYY-MM-DD oder null",
    "gesamt": 123.45
  }
}

Regeln fuer Anhang-Analyse:
- Lieferant = Firmenname im Briefkopf/Logo des Dokuments (NICHT der E-Mail-Absender)
- teile = JEDE einzelne Position/Artikel aus dem Dokument auflisten
- rechnung darf nicht null sein wenn es eine Rechnung ist
- typ: "rechnung" bei Rechnung/Invoice, "lieferstatus" bei Lieferschein, "bestellbestaetigung" bei Auftragsbestaetigung`
    : `Diese E-Mail wurde moeglicherweise weitergeleitet. Kein Anhang vorhanden.

Weitergeleitet von: ${absenderName} <${absenderEmail}>
Betreff: ${betreff}
Inhalt:
${bodyText}

WICHTIG: "${absenderName}" ist der Weiterleitende (interner Mitarbeiter), NICHT der Lieferant!
Suche im Text nach dem URSPRUENGLICHEN Absender/Lieferanten:
- Zeilen mit "Von:", "From:", "Gesendet von:", "Absender:" im E-Mail-Body
- Firmenname im Briefkopf oder Footer des weitergeleiteten Textes
- E-Mail-Domain des urspruenglichen Absenders (z.B. "finanzbuchhaltung@teileservice.de" → Lieferant = "Teileservice" oder Firmenname aus dem Text)

Antworte mit exakt diesem JSON:
{
  "typ": "rechnung",
  "lieferant": "FIRMENNAME DES ORIGINAL-LIEFERANTEN (nicht ${absenderName})",
  "status": "bestellt",
  "auftragsnummer": null,
  "kennzeichen": null,
  "teile": [
    { "bezeichnung": "Artikelname", "teilenummer": null, "menge": 1, "einzelpreis": null }
  ],
  "rechnung": {
    "rechnungsnummer": null,
    "datum": null,
    "faellig_am": null,
    "gesamt": null
  }
}

Regeln:
- lieferant: NIEMALS "${absenderName}" — das ist der interne Mitarbeiter der weitergeleitet hat
- typ: "rechnung" bei Rechnungstext, "lieferstatus" bei Versand/Lieferung, "bestellbestaetigung" bei Bestellung, "sonstiges" sonst
- teile: alle Artikel/Positionen aus dem Text extrahieren, falls vorhanden`

  const contentBlocks: Anthropic.MessageParam['content'] = []

  // Alle Anhaenge hinzufuegen (PDFs + Bilder)
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
        contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: anhang.contentBytes } })
      }
    } catch { /* kaputten Anhang ueberspringen */ }
  }

  contentBlocks.push({ type: 'text', text: prompt })

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
      { error: 'Microsoft-Konto nicht verbunden. Bitte unter Einstellungen verbinden.' },
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
    let duplikate = 0
    const fehler: string[] = []
    const verarbeitet: string[] = []

    // Nur relevante E-Mails verarbeiten (Anhang ODER Rechnungs-Keywords im Betreff)
    const rechnungsKeywords = /rechnung|invoice|zahlungsavis|bestellung|liefersch|order|faktura/i
    const relevanteMessages = messages.filter(msg =>
      msg.hasAttachments || rechnungsKeywords.test(msg.subject ?? '')
    )
    verarbeitet.push(`📊 ${messages.length} E-Mails total, ${relevanteMessages.length} relevant`)

    for (const msg of relevanteMessages) {
      try {
        let anhaenge: { name: string; contentType: string; contentBytes: string }[] = []
        if (msg.hasAttachments) {
          try {
            anhaenge = await fetchAttachments(accessToken, msg.id)
          } catch (e: any) {
            fehler.push(`Anhang-Fehler "${msg.subject?.slice(0, 30)}": ${e.message}`)
          }
        }
        verarbeitet.push(`📧 "${msg.subject?.slice(0, 40)}" — Anhänge=${anhaenge.length}`)

        let analyse: EmailAnalyse | null = null

        if (anthropic) {
          try {
            analyse = await analysiereEmailMitClaude(anthropic, msg, anhaenge)
            verarbeitet.push(`🤖 Claude: typ=${analyse.typ}, lieferant=${analyse.lieferant}, teile=${analyse.teile.length}`)
          } catch (e: any) {
            fehler.push(`Claude-Fehler "${msg.subject}": ${e.message}`)
          }
        } else {
          fehler.push(`Kein Claude API-Key`)
        }

        // Fallback auf Regex wenn Claude nicht verfuegbar
        if (!analyse) {
          const inhalt = msg.body.contentType === 'html'
            ? msg.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            : msg.body.content
          const { parseEmail, istRechnungsEmail, parseRechnung } = await import('@/lib/email-parser')
          const parsed = parseEmail({ absender: msg.from.emailAddress.address, betreff: msg.subject ?? '', inhalt })
          const istRechnung = istRechnungsEmail(msg.subject ?? '', inhalt) || msg.hasAttachments
          analyse = {
            typ: istRechnung ? 'rechnung' : 'lieferstatus',
            lieferant: parsed.lieferant !== 'Unbekannt' ? parsed.lieferant : (msg.from.emailAddress.name || msg.from.emailAddress.address),
            status: parsed.status,
            auftragsnummer: parsed.auftragsnummer,
            kennzeichen: parsed.kennzeichen,
            teile: parsed.teile,
            rechnung: istRechnung ? (() => { const r = parseRechnung({ absender: msg.from.emailAddress.address, betreff: msg.subject ?? '', inhalt }); return { rechnungsnummer: r.rechnungsnummer, datum: r.datum, faellig_am: r.faelligAm, gesamt: r.gesamt } })() : null,
          }
        }

        if (!analyse) {
          await markMessageAsRead(accessToken, msg.id)
          continue
        }

        // Wenn PDF-Anhang vorhanden, immer als Rechnung behandeln
        if (anhaenge.length > 0 && analyse.typ !== 'rechnung') {
          analyse.typ = 'rechnung'
          if (!analyse.rechnung) analyse.rechnung = { rechnungsnummer: null, datum: null, faellig_am: null, gesamt: null }
        }

        // ── Rechnung importieren ────────────────────────────────────────
        if (analyse.typ === 'rechnung') {
          const r = analyse.rechnung

          // Duplikat-Check: gleiche Rechnungsnummer ODER gleicher Absender + gleiches Datum
          if (r?.rechnungsnummer) {
            const { data: exist } = await supabase.from('rechnungen')
              .select('id').eq('rechnungsnummer', r.rechnungsnummer).maybeSingle()
            if (exist) {
              duplikate++
              await markMessageAsRead(accessToken, msg.id)
              continue
            }
          } else {
            // Kein Rechnungsnummer: check Absender + Datum
            const absenderEmail = msg.from.emailAddress.address
            const datum = r?.datum ?? new Date().toISOString().split('T')[0]
            const { data: exist } = await supabase.from('rechnungen')
              .select('id').eq('absender_email', absenderEmail).eq('datum', datum).maybeSingle()
            if (exist) {
              duplikate++
              await markMessageAsRead(accessToken, msg.id)
              continue
            }
          }

          const { data: neu } = await supabase.from('rechnungen').insert({
            lieferant: analyse.lieferant,
            rechnungsnummer: r?.rechnungsnummer ?? null,
            datum: r?.datum ?? null,
            faellig_am: r?.faellig_am ?? null,
            gesamt: r?.gesamt ?? null,
            absender_email: msg.from.emailAddress.address,
            bezahlt: false,
          }).select('id').maybeSingle()

          if (neu && analyse.teile.length > 0) {
            await supabase.from('rechnung_positionen').insert(
              analyse.teile.map(t => ({
                rechnung_id: neu.id,
                bezeichnung: t.bezeichnung,
                teilenummer: t.teilenummer ?? null,
                menge: t.menge ?? 1,
                einzelpreis: t.einzelpreis ?? null,
                gesamtpreis: t.einzelpreis && t.menge ? Math.round(t.einzelpreis * t.menge * 100) / 100 : null,
              }))
            )
          }

          rechnungenImportiert++
          verarbeitet.push(`Rechnung: ${analyse.lieferant}${r?.rechnungsnummer ? ` (${r.rechnungsnummer})` : ''} — ${analyse.teile.length} Positionen, ${anhaenge.length} Anhänge gelesen`)
          await markMessageAsRead(accessToken, msg.id)
          continue
        }

        // ── Lieferstatus / Teile-Updates ────────────────────────────────
        if (analyse.status === 'unbekannt' && analyse.typ === 'sonstiges') {
          await markMessageAsRead(accessToken, msg.id)
          continue
        }

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
              .order('erstellt_am', { ascending: false }).limit(1).maybeSingle()
            if (a) auftragId = a.id
          }
        }

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

        if (auftragId && analyse.status !== 'unbekannt' && analyse.teile.length > 0) {
          const statusReihenfolge = ['nicht_bestellt', 'bestellt', 'unterwegs', 'geliefert', 'eingebaut']

          for (const teil of analyse.teile) {
            if (!teil.bezeichnung || teil.bezeichnung === 'Siehe E-Mail') continue

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
      duplikate,
      verarbeitet,
      fehler,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
