import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import QRCode from 'qrcode'
import { buildGiroCode } from '@/lib/girocode'

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

async function buildRechnungHtml(auftrag: any, firma: Record<string, string>): Promise<string> {
  const fz = auftrag.fahrzeug ?? {}
  const kd = auftrag.kunde ?? {}
  const teile = (auftrag.ersatzteile ?? []) as any[]
  const kleinunternehmer = firma.firma_kleinunternehmer === 'ja'

  const teileNetto = teile.reduce((s: number, t: any) => {
    const ep = kleinunternehmer ? (t.einzelpreis ?? 0) : (t.einzelpreis ?? 0) / 1.19
    return s + ep * (t.menge ?? 1)
  }, 0)

  const arbeitNetto: number = auftrag._arbeit_netto ?? 0
  const sonstigesNetto: number = auftrag._sonstiges_netto ?? 0
  const kleinteilNetto: number = auftrag._kleinteil_netto ?? 0
  const gesamtNetto = teileNetto + arbeitNetto + sonstigesNetto + kleinteilNetto
  const mwstBetrag = kleinunternehmer ? 0 : gesamtNetto * 0.19
  const gesamtBrutto = gesamtNetto + mwstBetrag

  const rechnungsDatum = auftrag.fertiggestellt_am ?? auftrag.aktualisiert_am ?? new Date().toISOString()
  const zahlungsziel = new Date(new Date(rechnungsDatum).getTime() + 14 * 86_400_000)
  const rechnungsJahr = new Date(rechnungsDatum).getFullYear()
  const auftragNummer = (auftrag.auftrag_nr ?? '').replace(/^AU-/i, '')
  const rechnungsNr = `RE-${auftragNummer}-${rechnungsJahr}`

  // QR Codes server-side generieren
  const giroCode = firma.firma_iban
    ? buildGiroCode({
        bic: firma.firma_bic,
        name: firma.firma_name || 'Werkstatt',
        iban: firma.firma_iban,
        betrag: gesamtBrutto,
        verwendungszweck: `Rechnung ${auftragNummer}`,
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

  const teileRows = teile.map((t: any, i: number) => {
    const ep = kleinunternehmer ? (t.einzelpreis ?? 0) : (t.einzelpreis ?? 0) / 1.19
    const gp = ep * (t.menge ?? 1)
    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:5px 8px;font-size:11px;">${i + 2}</td>
        <td style="padding:5px 8px;font-size:11px;">${t.bezeichnung}${t.lieferant ? ` (${t.lieferant})` : ''}</td>
        <td style="padding:5px 8px;font-size:10px;font-family:monospace;">${t.teilenummer || '—'}</td>
        <td style="padding:5px 8px;font-size:11px;text-align:right;">${t.menge}x</td>
        <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(ep)}</td>
        <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(gp)}</td>
      </tr>`
  }).join('')

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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Rechnung ${rechnungsNr}</title></head>
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
      <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Nr. ${rechnungsNr}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">Datum: ${fmt(rechnungsDatum)}</div>
    </div>
  </div>

  <!-- Inhalt -->
  <div style="padding:28px 32px;">

    <!-- Hinweistext -->
    <p style="font-size:13px;color:#475569;margin:0 0 20px;">Sehr geehrte Damen und Herren,<br>anbei erhalten Sie Ihre Rechnung für die durchgeführten Arbeiten an Ihrem Fahrzeug. Vielen Dank für Ihr Vertrauen!</p>

    <!-- Adress-Grid -->
    <div style="display:flex;gap:24px;margin-bottom:20px;">
      <div style="flex:1;background:#f8fafc;border-radius:8px;padding:12px 16px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:6px;">Rechnungsempfänger</div>
        <div style="font-size:12px;line-height:1.7;">
          ${kd.firma ? `<strong>${kd.firma}</strong><br>` : ''}
          ${(kd.vorname || kd.nachname) ? `<strong>${kd.vorname ?? ''} ${kd.nachname ?? ''}</strong><br>` : 'Kein Kunde hinterlegt'}
          ${kd.strasse ? kd.strasse + '<br>' : ''}
          ${(kd.plz || kd.ort) ? `${kd.plz ?? ''} ${kd.ort ?? ''}<br>` : ''}
          ${kd.telefon ? 'Tel.: ' + kd.telefon + '<br>' : ''}
          ${kd.email ? kd.email : ''}
        </div>
      </div>
      <div style="flex:1;background:#f8fafc;border-radius:8px;padding:12px 16px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:6px;">Fahrzeugdaten</div>
        <div style="font-size:12px;line-height:1.7;">
          <strong>${fz.marke ?? ''} ${fz.modell ?? ''}</strong><br>
          Kennzeichen: ${fz.kennzeichen || '—'}<br>
          ${fz.fahrgestellnummer ? 'FIN: ' + fz.fahrgestellnummer + '<br>' : ''}
          ${fz.kilometerstand ? fz.kilometerstand.toLocaleString('de-DE') + ' km' : ''}
        </div>
      </div>
    </div>

    <!-- Positionen-Tabelle -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <thead>
        <tr style="background:#1e293b;color:white;">
          <th style="padding:7px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;">Pos.</th>
          <th style="padding:7px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;">Beschreibung</th>
          <th style="padding:7px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;">Teile-Nr.</th>
          <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;">Menge</th>
          <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;">Einzel (netto)</th>
          <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;">Gesamt (netto)</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background:#f8fafc;">
          <td colspan="6" style="padding:5px 8px;font-size:11px;font-weight:700;color:#475569;">Arbeitsleistung</td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:5px 8px;font-size:11px;">1</td>
          <td style="padding:5px 8px;font-size:11px;">
            Reparatur- und Wartungsarbeiten<br>
            <span style="font-size:10px;color:#64748b;">
              ${auftrag._arbeit_stunden
                ? `${auftrag._arbeit_stunden} Std. × ${auftrag._stundensatz} €/Std.`
                : (auftrag.arbeiten || 'Gemäß Auftrag Nr. ' + auftrag.auftrag_nr)}
            </span>
          </td>
          <td style="padding:5px 8px;font-size:10px;">—</td>
          <td style="padding:5px 8px;font-size:11px;text-align:right;">${auftrag._arbeit_stunden ? auftrag._arbeit_stunden + ' h' : '1'}</td>
          <td style="padding:5px 8px;font-size:11px;text-align:right;">${auftrag._arbeit_stunden ? fmtEuro(auftrag._stundensatz ?? 0) : fmtEuro(arbeitNetto)}</td>
          <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(arbeitNetto)}</td>
        </tr>

        ${teile.length > 0 ? `
          <tr style="background:#f8fafc;">
            <td colspan="6" style="padding:5px 8px;font-size:11px;font-weight:700;color:#475569;">Ersatzteile &amp; Material</td>
          </tr>
          ${teileRows}
        ` : ''}

        ${kleinteilNetto > 0 ? `
          <tr style="background:#f8fafc;"><td colspan="6" style="padding:5px 8px;font-size:11px;font-weight:700;color:#475569;">Kleinteilpauschale</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:5px 8px;font-size:11px;">${teile.length + 2}</td>
            <td style="padding:5px 8px;font-size:11px;">Kleinteilpauschale (Schrauben, Dichtungen, Kleinmaterial)</td>
            <td style="padding:5px 8px;">—</td><td style="padding:5px 8px;text-align:right;">1</td>
            <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(kleinteilNetto)}</td>
            <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(kleinteilNetto)}</td>
          </tr>
        ` : ''}

        ${sonstigesNetto > 0 ? `
          <tr style="background:#f8fafc;"><td colspan="6" style="padding:5px 8px;font-size:11px;font-weight:700;color:#475569;">Sonstiges</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:5px 8px;font-size:11px;">${teile.length + 2}</td>
            <td style="padding:5px 8px;font-size:11px;">Sonstige Leistungen</td>
            <td style="padding:5px 8px;">—</td><td style="padding:5px 8px;text-align:right;">1</td>
            <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(sonstigesNetto)}</td>
            <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(sonstigesNetto)}</td>
          </tr>
        ` : ''}

        <!-- Summen -->
        <tr><td colspan="6" style="height:8px;"></td></tr>
        <tr>
          <td colspan="5" style="padding:5px 8px;font-size:12px;text-align:right;color:#475569;">Zwischensumme (netto):</td>
          <td style="padding:5px 8px;font-size:12px;text-align:right;">${fmtEuro(gesamtNetto)}</td>
        </tr>
        ${!kleinunternehmer ? `
          <tr>
            <td colspan="5" style="padding:5px 8px;font-size:12px;text-align:right;color:#475569;">zzgl. 19% MwSt.:</td>
            <td style="padding:5px 8px;font-size:12px;text-align:right;">${fmtEuro(mwstBetrag)}</td>
          </tr>
          <tr style="background:#f8fafc;border-top:2px solid #1e293b;">
            <td colspan="5" style="padding:7px 8px;font-size:14px;font-weight:700;text-align:right;">Gesamtbetrag (brutto):</td>
            <td style="padding:7px 8px;font-size:14px;font-weight:700;text-align:right;color:#ea580c;">${fmtEuro(gesamtBrutto)}</td>
          </tr>
        ` : `
          <tr style="background:#f8fafc;border-top:2px solid #1e293b;">
            <td colspan="5" style="padding:7px 8px;font-size:14px;font-weight:700;text-align:right;">Gesamtbetrag:</td>
            <td style="padding:7px 8px;font-size:14px;font-weight:700;text-align:right;color:#ea580c;">${fmtEuro(gesamtBrutto)}</td>
          </tr>
          <tr><td colspan="6" style="padding:5px 8px;font-size:10px;color:#64748b;font-style:italic;">Gemäß §19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).</td></tr>
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
          Bitte Rechnungsnummer <strong>${rechnungsNr}</strong> angeben.
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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const body = await req.json()
  const { auftrag, firma, an, nachricht } = body as {
    auftrag: any
    firma: Record<string, string>
    an: string
    nachricht?: string
  }

  if (!an) return NextResponse.json({ error: 'Keine E-Mail-Adresse angegeben' }, { status: 400 })

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY fehlt. Bitte in den Umgebungsvariablen setzen.' },
      { status: 500 },
    )
  }

  const rechnungsJahr = new Date(auftrag.fertiggestellt_am ?? auftrag.erstellt_am ?? new Date()).getFullYear()
  const auftragNummer = (auftrag.auftrag_nr ?? '').replace(/^AU-/i, '')
  const rechnungsNr = `RE-${auftragNummer}-${rechnungsJahr}`
  const firmaName = firma.firma_name || 'Kfz-Werkstatt'
  const fromEmail = firma.firma_absender_email || 'rechnung@werkstatt-mail.de'

  const html = await buildRechnungHtml(auftrag, firma)

  // Optionale persönliche Nachricht als Prepend
  const finalHtml = nachricht
    ? html.replace(
        'Sehr geehrte Damen und Herren,',
        `${nachricht.replace(/\n/g, '<br>')}<br><br>Sehr geehrte Damen und Herren,`
      )
    : html

  const resend = new Resend(resendKey)
  const { error } = await resend.emails.send({
    from: `${firmaName} <${fromEmail}>`,
    to: an,
    subject: `Ihre Rechnung ${rechnungsNr} von ${firmaName}`,
    html: finalHtml,
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: (error as any).message ?? 'Sendefehler' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, rechnungsNr })
}
