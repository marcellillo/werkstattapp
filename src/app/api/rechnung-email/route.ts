import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

async function ladeFirmaConfig(): Promise<Record<string, string>> {
  const admin = createAdminClient()
  const { data: rows } = await admin.from('werkstatt_einstellungen').select('schluessel, wert')
  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert
  return cfg
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

  // Korrekte Positionsnummern (kein Duplikat wenn beide aktiv)
  const kleinteilPos = teile.length + 2
  const sonstigesPos = teile.length + 2 + (kleinteilNetto > 0 ? 1 : 0)

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
            <td style="padding:5px 8px;font-size:11px;">${kleinteilPos}</td>
            <td style="padding:5px 8px;font-size:11px;">Kleinteilpauschale (Schrauben, Dichtungen, Kleinmaterial)</td>
            <td style="padding:5px 8px;">—</td><td style="padding:5px 8px;text-align:right;">1</td>
            <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(kleinteilNetto)}</td>
            <td style="padding:5px 8px;font-size:11px;text-align:right;">${fmtEuro(kleinteilNetto)}</td>
          </tr>
        ` : ''}

        ${sonstigesNetto > 0 ? `
          <tr style="background:#f8fafc;"><td colspan="6" style="padding:5px 8px;font-size:11px;font-weight:700;color:#475569;">Sonstiges</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:5px 8px;font-size:11px;">${sonstigesPos}</td>
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
    // Manueller Versand: auftrag + firma Objekte vom Client
    auftrag: auftragBody,
    firma: firmaBody,
    an,
    nachricht,
    // Automatischer Versand: nur auftrag_id + typ
    auftrag_id,
    typ = 'rechnung', // 'rechnung' | 'fertig'
  } = body as {
    auftrag?: any
    firma?: Record<string, string>
    an?: string
    nachricht?: string
    auftrag_id?: string
    typ?: 'rechnung' | 'fertig'
  }

  // Firmakonfiguration: immer aus DB laden (aktuellste Werte)
  const firma = await ladeFirmaConfig()

  // API-Key: erst aus Einstellungen, dann aus Env
  const resendKey = firma.resend_api_key || process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json(
      { error: 'Resend API-Key fehlt. Bitte in Einstellungen → "Resend API-Key" eintragen oder als RESEND_API_KEY Umgebungsvariable setzen.' },
      { status: 500 },
    )
  }

  let auftrag = auftragBody
  let empfaenger = an

  // Server-seitiger Datenabruf wenn nur auftrag_id übergeben
  if (auftrag_id && !auftrag) {
    const { data } = await supabase
      .from('auftraege')
      .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)')
      .eq('id', auftrag_id)
      .single()
    if (!data) return NextResponse.json({ error: 'Auftrag nicht gefunden' }, { status: 404 })
    auftrag = data
    // E-Mail-Adresse aus Kunden-Daten wenn nicht explizit angegeben
    if (!empfaenger) empfaenger = data.kunde?.email
  }

  if (!auftrag) return NextResponse.json({ error: 'Kein Auftrag übergeben' }, { status: 400 })
  if (!empfaenger) return NextResponse.json({ error: 'Keine E-Mail-Adresse vorhanden' }, { status: 400 })

  const firmaName = firma.firma_name || 'Kfz-Werkstatt'
  const fromEmail = firma.firma_absender_email || 'onboarding@resend.dev'

  const rechnungsJahr = new Date(auftrag.fertiggestellt_am ?? auftrag.erstellt_am ?? new Date()).getFullYear()
  const auftragNummer = (auftrag.auftrag_nr ?? '').replace(/^AU-/i, '')
  const rechnungsNr = `RE-${auftragNummer}-${rechnungsJahr}`
  const fzName = `${auftrag.fahrzeug?.marke ?? ''} ${auftrag.fahrzeug?.modell ?? ''}`.trim()

  let html: string
  let subject: string

  if (typ === 'fertig') {
    html = buildFertigHtml(auftrag, firma)
    subject = `Ihr ${fzName} ist abholbereit – ${firmaName}`
  } else {
    html = await buildRechnungHtml(auftrag, firma)
    if (nachricht) {
      html = html.replace(
        'Sehr geehrte Damen und Herren,',
        `${nachricht.replace(/\n/g, '<br>')}<br><br>Sehr geehrte Damen und Herren,`
      )
    }
    subject = `Ihre Rechnung ${rechnungsNr} von ${firmaName}`
  }

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

  // Versand im E-Mail-Protokoll festhalten
  await supabase.from('email_protokoll').insert({
    betreff: subject,
    absender: fromEmail,
    inhalt: `An: ${empfaenger} | ${typ === 'fertig' ? 'Fertig-Benachrichtigung' : `Rechnung ${rechnungsNr}`}`,
    auftrag_id: auftrag.id ?? null,
    verarbeitet: true,
  })

  return NextResponse.json({ ok: true, rechnungsNr, typ })
}
