import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import QRCode from 'qrcode'
import { buildGiroCode } from '@/lib/girocode'
import { resolveRechnungDetail, type RechnungDetail } from '@/lib/rechnung-detail'

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtEuro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

async function toQrDataUrl(text: string): Promise<string | null> {
  if (!text) return null
  try {
    return await QRCode.toDataURL(text, { width: 96, margin: 1, errorCorrectionLevel: 'M' })
  } catch { return null }
}

async function ladeFirmaConfig(): Promise<Record<string, string>> {
  const admin = createAdminClient()
  const { data: rows } = await admin.from('werkstatt_einstellungen').select('schluessel, wert')
  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert
  return cfg
}

async function buildRechnungHtml(detail: RechnungDetail): Promise<string> {
  const fz = detail.fahrzeug ?? {}
  const kd = detail.kunde ?? {}
  const firma = detail.firma
  const { rechnung, kleinunternehmer, ersatzteilePositionen, arbeitswertePositionen } = detail
  const istPauschal = rechnung.anzeige_modus === 'pauschal'

  const zahlungsziel = new Date(new Date(rechnung.erstellt_am).getTime() + 14 * 86_400_000)

  const giroCode = firma.firma_iban
    ? buildGiroCode({
        bic: firma.firma_bic,
        name: firma.firma_name || 'Werkstatt',
        iban: firma.firma_iban,
        betrag: rechnung.betrag_brutto,
        verwendungszweck: `Rechnung ${rechnung.rechnungs_nr}`,
      })
    : null
  const [giroQr, paypalQr, sumupQr, stripeQr] = await Promise.all([
    toQrDataUrl(giroCode ?? ''),
    toQrDataUrl(firma.firma_paypal ?? ''),
    toQrDataUrl(firma.firma_sumup ?? ''),
    toQrDataUrl(firma.firma_stripe ?? ''),
  ])

  const qrItems = [
    giroQr   && { src: giroQr,   label: 'SEPA-Überweisung', hint: 'Banking-App scannen' },
    paypalQr && { src: paypalQr, label: 'PayPal',           hint: 'Kamera scannen' },
    sumupQr  && { src: sumupQr,  label: 'SumUp',            hint: 'Karte / Apple Pay' },
    stripeQr && { src: stripeQr, label: 'Stripe',           hint: 'Karte / Apple Pay' },
  ].filter(Boolean) as { src: string; label: string; hint: string }[]

  const ersatzteileRows = ersatzteilePositionen.map((pos, i) => istPauschal ? `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:5px 8px;font-size:11px;">${i + 1}</td>
        <td style="padding:5px 8px;font-size:11px;">${pos.beschreibung}</td>
      </tr>` : `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:5px 8px;font-size:11px;">${i + 1}</td>
        <td style="padding:5px 8px;font-size:11px;">${pos.beschreibung}</td>
        <td style="padding:5px 8px;font-size:11px;text-align:right;">${pos.menge}x</td>
        <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(pos.preis)}</td>
        <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(pos.summe)}</td>
      </tr>`).join('')

  const arbeitswerteAlle = [
    ...arbeitswertePositionen,
    ...(detail.kleinteilNetto > 0 ? [{ beschreibung: 'Kleinteilpauschale (Schrauben, Dichtungen, Kleinmaterial)', menge: 1, preis: detail.kleinteilNetto, summe: detail.kleinteilNetto }] : []),
    ...(detail.sonstigesNetto > 0 ? [{ beschreibung: detail.sonstigesBeschreibung || 'Sonstige Leistungen', menge: 1, preis: detail.sonstigesNetto, summe: detail.sonstigesNetto }] : []),
  ]
  const arbeitswerteRows = arbeitswerteAlle.map((pos, i) => istPauschal ? `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:5px 8px;font-size:11px;">${i + 1}</td>
        <td style="padding:5px 8px;font-size:11px;">${pos.beschreibung}</td>
      </tr>` : `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:5px 8px;font-size:11px;">${i + 1}</td>
        <td style="padding:5px 8px;font-size:11px;">${pos.beschreibung}</td>
        <td style="padding:5px 8px;font-size:11px;text-align:right;">${pos.menge}</td>
        <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(pos.preis)}</td>
        <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(pos.summe)}</td>
      </tr>`).join('')

  const positionsHeaderHtml = istPauschal ? `
        <tr style="background:#f1f5f9;">
          <th style="padding:7px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;">Pos.</th>
          <th style="padding:7px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;">Beschreibung</th>
        </tr>` : `
        <tr style="background:#f1f5f9;">
          <th style="padding:7px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;">Pos.</th>
          <th style="padding:7px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;">Beschreibung</th>
          <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;">Menge</th>
          <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;">Einzel (netto)</th>
          <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;">Gesamt (netto)</th>
        </tr>`
  const summenzeileColspan = istPauschal ? 1 : 4

  const logoBlock = firma.firma_logo
    ? `<img src="${firma.firma_logo}" alt="${firma.firma_name || 'Logo'}" style="max-height:60px;max-width:200px;object-fit:contain;margin-bottom:4px;" />`
    : `<div style="font-size:18px;font-weight:700;color:#ea580c;">${firma.firma_name || 'Kfz-Werkstatt'}</div>`

  const qrBlock = qrItems.length > 0 ? `
    <div style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:8px;padding:12px 16px;margin-top:16px;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#475569;border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin-bottom:10px;">Jetzt bezahlen</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${qrItems.map(q => `
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="${q.src}" alt="${q.label}" style="width:72px;height:72px;border-radius:4px;" />
            <div>
              <div style="font-size:10px;font-weight:700;color:#475569;">${q.label}</div>
              <div style="font-size:9px;color:#94a3b8;">${q.hint}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Rechnung ${rechnung.rechnungs_nr}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;">
<div style="max-width:680px;margin:24px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- Kopf -->
  <div style="background:#1e293b;padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>${logoBlock}
      <div style="font-size:10px;color:#94a3b8;margin-top:4px;line-height:1.6;">
        ${firma.firma_strasse ? firma.firma_strasse + '<br>' : ''}
        ${(firma.firma_plz || firma.firma_ort) ? `${firma.firma_plz} ${firma.firma_ort}<br>` : ''}
        ${firma.firma_telefon ? 'Tel.: ' + firma.firma_telefon + '<br>' : ''}
        ${firma.firma_email ? firma.firma_email : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:22px;font-weight:700;color:white;letter-spacing:-0.02em;">RECHNUNG</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Nr. ${rechnung.rechnungs_nr}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">Datum: ${fmt(rechnung.erstellt_am)}</div>
    </div>
  </div>

  <!-- Inhalt -->
  <div style="padding:28px 32px;">

    <p style="font-size:13px;color:#475569;margin:0 0 20px;">Sehr geehrte Damen und Herren,<br>anbei erhalten Sie Ihre Rechnung für die durchgeführten Arbeiten an Ihrem Fahrzeug. Vielen Dank für Ihr Vertrauen!</p>

    <!-- Adress-Grid -->
    <div style="display:flex;gap:24px;margin-bottom:20px;">
      <div style="flex:1;background:#f8fafc;border-radius:8px;padding:12px 16px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:6px;">Rechnungsempfänger</div>
        <div style="font-size:12px;line-height:1.7;">
          ${kd?.firma ? `<strong>${kd.firma}</strong><br>` : ''}
          ${(kd?.vorname || kd?.nachname) ? `<strong>${kd?.vorname ?? ''} ${kd?.nachname ?? ''}</strong><br>` : 'Kein Kunde hinterlegt'}
          ${kd?.strasse ? kd.strasse + '<br>' : ''}
          ${(kd?.plz || kd?.ort) ? `${kd?.plz ?? ''} ${kd?.ort ?? ''}<br>` : ''}
          ${kd?.telefon ? 'Tel.: ' + kd.telefon + '<br>' : ''}
          ${kd?.email ? kd.email : ''}
        </div>
      </div>
      <div style="flex:1;background:#f8fafc;border-radius:8px;padding:12px 16px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:6px;">Fahrzeugdaten</div>
        <div style="font-size:12px;line-height:1.7;">
          <strong>${fz?.marke ?? ''} ${fz?.modell ?? ''}</strong><br>
          Kennzeichen: ${fz?.kennzeichen || '—'}<br>
          ${fz?.fin ? 'FIN: ' + fz.fin + '<br>' : ''}
          ${fz?.kilometerstand ? fz.kilometerstand.toLocaleString('de-DE') + ' km' : ''}
        </div>
      </div>
    </div>

    ${ersatzteilePositionen.length > 0 ? `
    <!-- Ersatzteile -->
    <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin:16px 0 4px;">Ersatzteile</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;border:1.5px solid #cbd5e1;border-radius:8px;overflow:hidden;">
      <thead>${positionsHeaderHtml}</thead>
      <tbody>
        ${ersatzteileRows}
        <tr style="background:#f8fafc;border-top:1.5px solid #cbd5e1;">
          <td colspan="${summenzeileColspan}" style="padding:6px 8px;font-size:11px;font-weight:700;text-align:right;">Summe</td>
          <td style="padding:6px 8px;font-size:11px;font-weight:700;text-align:right;">${fmtEuro(detail.ersatzteileNetto)}</td>
        </tr>
      </tbody>
    </table>
    ` : ''}

    <!-- Arbeitswerte -->
    <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin:16px 0 4px;">Arbeitswerte</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;border:1.5px solid #cbd5e1;border-radius:8px;overflow:hidden;">
      <thead>${positionsHeaderHtml}</thead>
      <tbody>
        ${arbeitswerteRows || `<tr><td colspan="${istPauschal ? 2 : 5}" style="padding:6px 8px;font-size:11px;color:#94a3b8;font-style:italic;">Keine Arbeitszeit erfasst</td></tr>`}
        <tr style="background:#f8fafc;border-top:1.5px solid #cbd5e1;">
          <td colspan="${summenzeileColspan}" style="padding:6px 8px;font-size:11px;font-weight:700;text-align:right;">Summe</td>
          <td style="padding:6px 8px;font-size:11px;font-weight:700;text-align:right;">${fmtEuro(detail.arbeitNetto + detail.kleinteilNetto + detail.sonstigesNetto)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Gesamtsummen -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <tbody>
        ${ersatzteilePositionen.length > 0 ? `
        <tr>
          <td style="padding:5px 8px;font-size:12px;text-align:right;color:#475569;">Ersatzteile Summe:</td>
          <td style="padding:5px 8px;font-size:12px;text-align:right;width:110px;">${fmtEuro(detail.ersatzteileNetto)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:5px 8px;font-size:12px;text-align:right;color:#475569;">Arbeitsaufwand Summe:</td>
          <td style="padding:5px 8px;font-size:12px;text-align:right;">${fmtEuro(detail.arbeitNetto + detail.kleinteilNetto + detail.sonstigesNetto)}</td>
        </tr>
        <tr>
          <td style="padding:5px 8px;font-size:12px;text-align:right;color:#475569;">Netto-Gesamtbetrag:</td>
          <td style="padding:5px 8px;font-size:12px;text-align:right;">${fmtEuro(rechnung.betrag_netto)}</td>
        </tr>
        ${!kleinunternehmer ? `
          <tr>
            <td style="padding:5px 8px;font-size:12px;text-align:right;color:#475569;">zzgl. 19% MwSt.:</td>
            <td style="padding:5px 8px;font-size:12px;text-align:right;">${fmtEuro(rechnung.betrag_mwst)}</td>
          </tr>
          <tr style="background:#f8fafc;border-top:2px solid #1e293b;">
            <td style="padding:7px 8px;font-size:14px;font-weight:700;text-align:right;">Gesamtbetrag (brutto):</td>
            <td style="padding:7px 8px;font-size:14px;font-weight:700;text-align:right;color:#ea580c;">${fmtEuro(rechnung.betrag_brutto)}</td>
          </tr>
        ` : `
          <tr style="background:#f8fafc;border-top:2px solid #1e293b;">
            <td style="padding:7px 8px;font-size:14px;font-weight:700;text-align:right;">Gesamtbetrag:</td>
            <td style="padding:7px 8px;font-size:14px;font-weight:700;text-align:right;color:#ea580c;">${fmtEuro(rechnung.betrag_brutto)}</td>
          </tr>
          <tr><td colspan="2" style="padding:5px 8px;font-size:10px;color:#64748b;font-style:italic;">Gemäß §19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).</td></tr>
        `}
      </tbody>
    </table>

    <!-- Zahlungsinfo -->
    <div style="display:flex;gap:16px;margin-top:20px;">
      <div style="flex:1;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:8px;padding:12px 16px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#475569;border-bottom:1px solid #cbd5e1;padding-bottom:5px;margin-bottom:8px;">Zahlungsziel</div>
        <div style="font-size:12px;line-height:1.7;">
          <strong style="color:#ea580c;">${zahlungsziel.toLocaleDateString('de-DE')}</strong><br>
          Zahlung per Überweisung oder bar.<br>
          Bitte Rechnungsnummer <strong>${rechnung.rechnungs_nr}</strong> angeben.
        </div>
      </div>
      <div style="flex:1;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:8px;padding:12px 16px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#475569;border-bottom:1px solid #cbd5e1;padding-bottom:5px;margin-bottom:8px;">Bankverbindung</div>
        <div style="font-size:12px;line-height:1.7;">
          ${firma.firma_bank ? firma.firma_bank + '<br>' : ''}
          ${firma.firma_iban ? `IBAN: <strong>${firma.firma_iban}</strong><br>` : '<span style="color:#94a3b8">Bitte IBAN in Einstellungen eintragen</span>'}
          ${firma.firma_bic ? 'BIC: ' + firma.firma_bic : ''}
        </div>
      </div>
    </div>

    ${qrBlock}

    <!-- Fußzeile -->
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center;line-height:1.7;">
      ${firma.firma_name || 'Kfz-Werkstatt'}
      ${firma.firma_strasse ? ` · ${firma.firma_strasse}, ${firma.firma_plz} ${firma.firma_ort}` : ''}
      ${firma.firma_ust_id ? ` · USt-IdNr.: ${firma.firma_ust_id}` : ''}
      ${firma.firma_steuernummer ? ` · Steuernr.: ${firma.firma_steuernummer}` : ''}
      <br>Vielen Dank für Ihr Vertrauen!
    </div>

  </div>
</div>
</body>
</html>`
}

// Einfache Benachrichtigungs-E-Mail (Fahrzeug fertig, noch keine Rechnung)
function buildFertigHtml(auftrag: any, firma: Record<string, string>): string {
  const fz = auftrag.fahrzeug ?? {}
  const kd = auftrag.kunde ?? {}
  const firmaName = firma.firma_name || 'Kfz-Werkstatt'
  const logoBlock = firma.firma_logo
    ? `<img src="${firma.firma_logo}" alt="${firmaName}" style="max-height:56px;max-width:180px;object-fit:contain;" />`
    : `<div style="font-size:18px;font-weight:700;color:#ea580c;">${firmaName}</div>`

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Ihr Fahrzeug ist fertig</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#1a1a1a;">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <div style="background:#1e293b;padding:24px 32px;display:flex;justify-content:space-between;align-items:center;">
    ${logoBlock}
    <div style="background:#22c55e;border-radius:50%;width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-size:24px;">✅</div>
  </div>

  <div style="padding:32px;">
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#15803d;">Ihr Fahrzeug ist abholbereit!</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
      Guten Tag${kd.vorname ? ' ' + kd.vorname : ''},<br><br>
      Ihr Fahrzeug wurde fertig gestellt und kann jetzt abgeholt werden.
    </p>

    <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:18px;font-weight:700;color:#1e293b;">${fz.marke ?? ''} ${fz.modell ?? ''}</div>
      <div style="font-size:14px;font-family:monospace;color:#64748b;margin-top:2px;">${fz.kennzeichen || ''}</div>
      ${auftrag.arbeiten ? `<div style="font-size:12px;color:#475569;margin-top:8px;border-top:1px solid #bbf7d0;padding-top:8px;">Durchgeführte Arbeiten: ${auftrag.arbeiten}</div>` : ''}
    </div>

    ${(firma.firma_telefon || firma.firma_email) ? `
    <div style="font-size:13px;color:#475569;line-height:1.8;">
      <strong>Kontakt:</strong><br>
      ${firma.firma_telefon ? '📞 ' + firma.firma_telefon + '<br>' : ''}
      ${firma.firma_strasse ? '📍 ' + firma.firma_strasse + ', ' + (firma.firma_plz ?? '') + ' ' + (firma.firma_ort ?? '') : ''}
    </div>` : ''}
  </div>

  <div style="background:#f8fafc;padding:16px 32px;font-size:10px;color:#94a3b8;text-align:center;">
    ${firmaName}${firma.firma_strasse ? ' · ' + firma.firma_strasse + ', ' + (firma.firma_plz ?? '') + ' ' + (firma.firma_ort ?? '') : ''}
  </div>
</div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const body = await req.json()
  const {
    // Rechnungsversand: rechnungId + betriebId
    rechnungId,
    betriebId,
    an,
    nachricht,
    // Fertig-Benachrichtigung: auftrag_id + typ
    auftrag_id,
    typ = 'rechnung', // 'rechnung' | 'fertig'
  } = body as {
    rechnungId?: string
    betriebId?: string
    an?: string
    nachricht?: string
    auftrag_id?: string
    typ?: 'rechnung' | 'fertig'
  }

  if (typ === 'fertig') {
    // Fertig-Benachrichtigung: unverändertes Verhalten (globale Werkstatt-Einstellungen, auftrag_id)
    const firma = await ladeFirmaConfig()
    const resendKey = firma.resend_api_key || process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json(
        { error: 'Resend API-Key fehlt. Bitte in Einstellungen → "Resend API-Key" eintragen oder als RESEND_API_KEY Umgebungsvariable setzen.' },
        { status: 500 },
      )
    }
    if (!auftrag_id) return NextResponse.json({ error: 'auftrag_id erforderlich' }, { status: 400 })

    const { data: auftrag } = await supabase
      .from('auftraege')
      .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(*)')
      .eq('id', auftrag_id)
      .single()
    if (!auftrag) return NextResponse.json({ error: 'Auftrag nicht gefunden' }, { status: 404 })

    const empfaenger = an || auftrag.kunde?.email
    if (!empfaenger) return NextResponse.json({ error: 'Keine E-Mail-Adresse vorhanden' }, { status: 400 })

    const firmaName = firma.firma_name || 'Kfz-Werkstatt'
    const fromEmail = firma.firma_absender_email || 'onboarding@resend.dev'
    const fzName = `${auftrag.fahrzeug?.marke ?? ''} ${auftrag.fahrzeug?.modell ?? ''}`.trim()

    const html = buildFertigHtml(auftrag, firma)
    const subject = `Ihr ${fzName} ist abholbereit – ${firmaName}`

    const resend = new Resend(resendKey)
    const { error } = await resend.emails.send({ from: `${firmaName} <${fromEmail}>`, to: empfaenger, subject, html })
    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: (error as any).message ?? 'Sendefehler' }, { status: 500 })
    }

    await supabase.from('email_protokoll').insert({
      betreff: subject,
      absender: fromEmail,
      inhalt: `An: ${empfaenger} | Fertig-Benachrichtigung`,
      auftrag_id: auftrag.id ?? null,
      verarbeitet: true,
    })

    return NextResponse.json({ ok: true, typ })
  }

  // Rechnungsversand
  if (!rechnungId || !betriebId) {
    return NextResponse.json({ error: 'rechnungId und betriebId erforderlich' }, { status: 400 })
  }

  const { data: betriebCheck } = await supabase
    .from('betrieb_users')
    .select('id')
    .eq('betrieb_id', betriebId)
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!betriebCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const detail = await resolveRechnungDetail(supabase, rechnungId, betriebId)
  if (!detail) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })

  const empfaenger = an || detail.kunde?.email
  if (!empfaenger) return NextResponse.json({ error: 'Keine E-Mail-Adresse vorhanden' }, { status: 400 })

  const resendKey = detail.firma.resend_api_key || process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json(
      { error: 'Resend API-Key fehlt. Bitte in Einstellungen → "Resend API-Key" eintragen oder als RESEND_API_KEY Umgebungsvariable setzen.' },
      { status: 500 },
    )
  }

  const firmaName = detail.firma.firma_name || 'Kfz-Werkstatt'
  const fromEmail = detail.firma.firma_absender_email || 'onboarding@resend.dev'

  let html = await buildRechnungHtml(detail)
  if (nachricht) {
    html = html.replace(
      'Sehr geehrte Damen und Herren,',
      `${nachricht.replace(/\n/g, '<br>')}<br><br>Sehr geehrte Damen und Herren,`
    )
  }
  const subject = `Ihre Rechnung ${detail.rechnung.rechnungs_nr} von ${firmaName}`

  const resend = new Resend(resendKey)
  const { error } = await resend.emails.send({
    from: `${firmaName} <${fromEmail}>`,
    to: empfaenger,
    subject,
    html,
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: (error as any).message ?? 'Sendefehler' }, { status: 500 })
  }

  await supabase.from('email_protokoll').insert({
    betreff: subject,
    absender: fromEmail,
    inhalt: `An: ${empfaenger} | Rechnung ${detail.rechnung.rechnungs_nr}`,
    auftrag_id: detail.rechnung.auftrag_id,
    verarbeitet: true,
  })

  return NextResponse.json({ ok: true, rechnungsNr: detail.rechnung.rechnungs_nr, typ })
}
