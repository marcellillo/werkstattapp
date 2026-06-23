import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { fetchUnreadInvoiceMails, markAsRead } from '@/lib/imap-client'
import { parseEmail } from '@/lib/email-parser'

const RECHNUNG_BETREFF = /rechnung|faktura|invoice|re-\d|re:\s*\d/i

const EXTRAKT_PROMPT = `Analysiere diese Lieferantenrechnung und extrahiere alle relevanten Daten.

Antworte NUR mit einem JSON-Objekt (kein Markdown, kein Text darum herum):
{
  "lieferant": "Firmenname des Lieferanten",
  "rechnungsnummer": "Rechnungsnummer oder null",
  "datum": "YYYY-MM-DD oder null",
  "gesamt": 123.45,
  "positionen": [
    {
      "bezeichnung": "Artikelbezeichnung",
      "teilenummer": "Teilenummer oder null",
      "menge": 1,
      "einzelpreis": 49.99,
      "gesamtpreis": 49.99
    }
  ]
}

Regeln: Preise als Zahlen ohne €, Mengen als Zahlen, fehlende Werte = null, Teilenummern unbedingt erfassen.
Wenn kein Rechnungsinhalt erkennbar: { "lieferant": null, "positionen": [] }`

async function extractRechnungFromPdf(client: Anthropic, base64: string, contentType: string) {
  const isPdf = contentType === 'application/pdf'
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        isPdf
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
          : { type: 'image', source: { type: 'base64', media_type: contentType as any, data: base64 } },
        { type: 'text', text: EXTRAKT_PROMPT },
      ],
    }],
  })
  const text = msg.content.find(b => b.type === 'text')?.text ?? ''
  return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
}

async function extractRechnungFromText(client: Anthropic, emailText: string) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `${EXTRAKT_PROMPT}\n\nE-Mail Inhalt:\n${emailText.slice(0, 6000)}`,
    }],
  })
  const text = msg.content.find(b => b.type === 'text')?.text ?? ''
  return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
}

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  // Konfiguration laden
  const { data: configRows } = await supabase
    .from('werkstatt_einstellungen')
    .select('schluessel, wert')

  const cfg: Record<string, string> = {}
  for (const row of configRows ?? []) {
    if (row.wert) cfg[row.schluessel] = row.wert
  }

  const { imap_email, imap_password, anthropic_api_key } = cfg

  if (!imap_email || !imap_password) {
    return NextResponse.json(
      { error: 'E-Mail-Konto noch nicht konfiguriert. Bitte unter Einstellungen → E-Mail-Integration ausfüllen.' },
      { status: 400 },
    )
  }

  const effectiveAnthropicKey = anthropic_api_key || process.env.ANTHROPIC_API_KEY
  const anthropicClient = effectiveAnthropicKey ? new Anthropic({ apiKey: effectiveAnthropicKey }) : null

  try {
    const emails = await fetchUnreadInvoiceMails({ email: imap_email, password: imap_password })

    let neuErstellt = 0
    let statusAktualisiert = 0
    let rechnungenImportiert = 0
    const fehler: string[] = []

    for (const email of emails) {
      try {
        const inhalt = email.html
          ? email.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)
          : email.text.slice(0, 6000)

        // ── Rechnungs-Erkennung ──────────────────────────────────
        const istRechnung = RECHNUNG_BETREFF.test(email.subject ?? '') || email.attachments.length > 0
        if (istRechnung && anthropicClient) {
          let extrakt: any = null
          try {
            if (email.attachments.length > 0) {
              const att = email.attachments[0]
              const base64 = att.content.toString('base64')
              extrakt = await extractRechnungFromPdf(anthropicClient, base64, att.contentType)
            } else if (inhalt.length > 100) {
              extrakt = await extractRechnungFromText(anthropicClient, inhalt)
            }

            if (extrakt?.positionen?.length) {
              let duplikat = false
              if (extrakt.rechnungsnummer && extrakt.lieferant) {
                const { data: ex } = await supabase
                  .from('rechnungen')
                  .select('id')
                  .eq('rechnungsnummer', extrakt.rechnungsnummer)
                  .eq('lieferant', extrakt.lieferant)
                  .maybeSingle()
                if (ex) duplikat = true
              }

              if (!duplikat) {
                const { data: rechnung } = await supabase
                  .from('rechnungen')
                  .insert({
                    lieferant: extrakt.lieferant,
                    rechnungsnummer: extrakt.rechnungsnummer,
                    datum: extrakt.datum,
                    gesamt: extrakt.gesamt,
                    quelle: 'email',
                  })
                  .select('id')
                  .single()

                if (rechnung) {
                  await supabase.from('rechnung_positionen').insert(
                    extrakt.positionen.map((p: any) => ({
                      rechnung_id: rechnung.id,
                      bezeichnung: p.bezeichnung,
                      teilenummer: p.teilenummer,
                      menge: p.menge ?? 1,
                      einzelpreis: p.einzelpreis,
                      gesamtpreis: p.gesamtpreis,
                    }))
                  )
                  rechnungenImportiert++
                }
              }
            }
          } catch (e: any) {
            fehler.push(`Rechnung "${email.subject}": ${e.message}`)
          }
          await markAsRead({ email: imap_email, password: imap_password }, email.uid)
          continue
        }

        // ── Bestellstatus-Mails ───────────────────────────────────
        const parsed = parseEmail({
          absender: email.from,
          betreff: email.subject ?? '',
          inhalt,
        })

        let auftragId: string | null = null
        if (parsed.auftragsnummer) {
          const { data: auftrag } = await supabase
            .from('auftraege')
            .select('id')
            .ilike('auftrag_nr', `%${parsed.auftragsnummer}%`)
            .single()
          if (auftrag) auftragId = auftrag.id
        }

        if (!auftragId && parsed.kennzeichen) {
          const { data: fahrzeug } = await supabase
            .from('fahrzeuge')
            .select('id')
            .ilike('kennzeichen', `%${parsed.kennzeichen}%`)
            .single()

          if (fahrzeug) {
            const { data: auftrag } = await supabase
              .from('auftraege')
              .select('id')
              .eq('fahrzeug_id', fahrzeug.id)
              .not('status', 'in', '("fertig","ausgeliefert")')
              .order('erstellt_am', { ascending: false })
              .limit(1)
              .single()
            if (auftrag) auftragId = auftrag.id
          }
        }

        const { data: protokoll } = await supabase
          .from('email_protokoll')
          .insert({
            auftrag_id: auftragId,
            absender: email.from,
            betreff: email.subject,
            inhalt,
            empfangen_am: email.date.toISOString(),
            erkannter_status: parsed.status !== 'unbekannt' ? parsed.status : null,
            verarbeitet: false,
          })
          .select('id')
          .single()

        if (auftragId && parsed.status !== 'unbekannt') {
          for (const teil of parsed.teile) {
            const { data: vorhanden } = await supabase
              .from('ersatzteile')
              .select('id, status')
              .eq('auftrag_id', auftragId)
              .or(
                teil.teilenummer
                  ? `teilenummer.eq.${teil.teilenummer},bezeichnung.ilike.%${teil.bezeichnung}%`
                  : `bezeichnung.ilike.%${teil.bezeichnung}%`
              )
              .limit(1)
              .single()

            if (vorhanden) {
              const statusReihenfolge = ['nicht_bestellt', 'bestellt', 'unterwegs', 'geliefert', 'eingebaut']
              const aktuellIdx = statusReihenfolge.indexOf(vorhanden.status)
              const neuIdx = statusReihenfolge.indexOf(parsed.status)
              if (neuIdx > aktuellIdx) {
                await supabase
                  .from('ersatzteile')
                  .update({
                    status: parsed.status,
                    ...(parsed.status === 'geliefert' ? { geliefert_am: new Date().toISOString().split('T')[0] } : {}),
                  })
                  .eq('id', vorhanden.id)
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
              nachricht: `Lieferung von ${parsed.lieferant} für Auftrag eingetroffen. ${parsed.teile.map(t => t.bezeichnung).join(', ')}`,
              typ: 'teil_eingetroffen',
              auftrag_id: auftragId,
              gelesen: false,
            })
          }

          if (protokoll) {
            await supabase.from('email_protokoll').update({ verarbeitet: true }).eq('id', protokoll.id)
          }
        }

        await markAsRead({ email: imap_email, password: imap_password }, email.uid)

      } catch (e: any) {
        fehler.push(`${email.subject}: ${e.message}`)
      }
    }

    await supabase.from('werkstatt_einstellungen').upsert({
      schluessel: 'letzter_email_sync',
      wert: new Date().toISOString(),
    }, { onConflict: 'schluessel' })

    return NextResponse.json({
      erfolg: true,
      emailsGeprueft: emails.length,
      neuErstellt,
      statusAktualisiert,
      rechnungenImportiert,
      fehler,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
