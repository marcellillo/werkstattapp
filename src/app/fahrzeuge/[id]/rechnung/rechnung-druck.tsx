'use client'
import { useEffect } from 'react'

function fmt(date?: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtEuro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function RechnungDruck({ auftrag, firma }: { auftrag: any; firma: Record<string, string> }) {
  const fz = auftrag.fahrzeug ?? {}
  const kd = auftrag.kunde ?? {}
  const teile = (auftrag.ersatzteile ?? []) as any[]
  const kleinunternehmer = firma.firma_kleinunternehmer === 'ja'
  const mwstSatz = kleinunternehmer ? 0 : 19

  // Teile-Netto (einzelpreis in DB ist Bruttopreis bei MwSt, Nettopreis bei Kleinunternehmer)
  const teileNetto = teile.reduce((s: number, t: any) => {
    const ep = kleinunternehmer ? (t.einzelpreis ?? 0) : (t.einzelpreis ?? 0) / 1.19
    return s + ep * (t.menge ?? 1)
  }, 0)

  // Werte kommen vom Flow vorberechnet (via _arbeit_netto etc.)
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

  useEffect(() => { window.print() }, [])

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: white; font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; }
        @page { size: A4; margin: 20mm 15mm 20mm 25mm; }
        @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        .page { max-width: 794px; margin: 0 auto; padding: 24px; }

        /* Briefkopf */
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .firma-block { }
        .firma-name { font-size: 18px; font-weight: 700; color: #ea580c; }
        .firma-details { font-size: 10px; color: #555; margin-top: 4px; line-height: 1.6; }
        .rechnung-block { text-align: right; }
        .rechnung-titel { font-size: 22px; font-weight: 700; color: #1e293b; }
        .rechnung-nr { font-size: 12px; color: #64748b; margin-top: 4px; }
        .rechnung-datum { font-size: 10px; color: #94a3b8; margin-top: 2px; }

        /* Trennlinie */
        .trennlinie { border: none; border-top: 2px solid #ea580c; margin: 16px 0; }

        /* Adressblock */
        .adressen { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .adresse-box { }
        .adresse-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 6px; }
        .adresse-wert { font-size: 11px; line-height: 1.7; }
        .adresse-wert strong { font-size: 12px; }

        /* Fahrzeug-Info */
        .fz-box { background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .fz-feld { border-right: 1px solid #e2e8f0; padding-right: 8px; }
        .fz-feld:last-child { border-right: none; }
        .fz-label { font-size: 8px; text-transform: uppercase; color: #64748b; letter-spacing: 0.06em; font-weight: 700; }
        .fz-wert { font-size: 11px; font-weight: 700; color: #0f172a; margin-top: 3px; }

        /* Positionen-Tabelle */
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        thead tr { background: #1e293b; color: white; }
        th { padding: 7px 10px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        th.ta-right { text-align: right; }
        td { padding: 6px 10px; font-size: 10px; border-bottom: 1px solid #f1f5f9; }
        td.ta-right { text-align: right; }
        tr.section-header td { background: #f8fafc; font-weight: 700; font-size: 10px; color: #475569; padding: 5px 10px; }
        tr.summen td { padding: 5px 10px; font-size: 11px; }
        tr.gesamt td { font-weight: 700; font-size: 13px; border-top: 2px solid #1e293b; background: #f8fafc; }
        tr.mwst-hinweis td { font-size: 9px; color: #64748b; font-style: italic; padding: 8px 10px; }

        /* Zahlungsinfo */
        .zahlung { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
        .zahlung-box { background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; }
        .zahlung-titel { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.06em; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
        .zahlung-wert { font-size: 11px; line-height: 1.8; }
        .zahlung-wert strong { color: #ea580c; }

        /* Fußzeile */
        .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; text-align: center; line-height: 1.6; }

        .print-btn { position: fixed; top: 16px; right: 16px; background: #ea580c; color: white; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; z-index: 999; }
        .back-btn { position: fixed; top: 16px; left: 16px; background: white; color: #334155; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; z-index: 999; }
      `}</style>

      <button className="no-print back-btn" onClick={() => history.back()}>← Zurück</button>
      <button className="no-print print-btn" onClick={() => window.print()}>Drucken / PDF</button>

      <div className="page">
        {/* Briefkopf */}
        <div className="header">
          <div className="firma-block">
            {firma.firma_logo
              ? <img src={firma.firma_logo} alt={firma.firma_name || 'Logo'} style={{maxHeight: '72px', maxWidth: '240px', objectFit: 'contain', marginBottom: '6px'}} />
              : <div className="firma-name">{firma.firma_name || 'Kfz-Werkstatt'}</div>
            }
            <div className="firma-details">
              {firma.firma_strasse && <>{firma.firma_strasse}<br /></>}
              {(firma.firma_plz || firma.firma_ort) && <>{firma.firma_plz} {firma.firma_ort}<br /></>}
              {firma.firma_telefon && <>Tel.: {firma.firma_telefon}<br /></>}
              {firma.firma_email && <>{firma.firma_email}</>}
            </div>
          </div>
          <div className="rechnung-block">
            <div className="rechnung-titel">RECHNUNG</div>
            <div className="rechnung-nr">Nr. {rechnungsNr}</div>
            <div className="rechnung-datum">Datum: {fmt(rechnungsDatum)}</div>
            <div className="rechnung-datum">Leistungsdatum: {fmt(auftrag.fertiggestellt_am ?? auftrag.erstellt_am)}</div>
          </div>
        </div>

        <hr className="trennlinie" />

        {/* Adressen */}
        <div className="adressen">
          <div className="adresse-box">
            <div className="adresse-label">Rechnungsempfänger</div>
            <div className="adresse-wert">
              {(kd.vorname || kd.nachname) ? (
                <>
                  {kd.firma && <><strong>{kd.firma}</strong><br /></>}
                  <strong>{kd.vorname} {kd.nachname}</strong><br />
                  {kd.strasse && <>{kd.strasse}<br /></>}
                  {(kd.plz || kd.ort) && <>{kd.plz} {kd.ort}<br /></>}
                  {kd.telefon && <>Tel.: {kd.telefon}<br /></>}
                  {kd.email && <>{kd.email}</>}
                </>
              ) : <span style={{color:'#94a3b8'}}>Kein Kunde hinterlegt</span>}
            </div>
          </div>
          <div className="adresse-box">
            <div className="adresse-label">Rechnungssteller</div>
            <div className="adresse-wert">
              <strong>{firma.firma_name || 'Kfz-Werkstatt'}</strong><br />
              {firma.firma_strasse && <>{firma.firma_strasse}<br /></>}
              {(firma.firma_plz || firma.firma_ort) && <>{firma.firma_plz} {firma.firma_ort}<br /></>}
              {firma.firma_ust_id && <>USt-IdNr.: {firma.firma_ust_id}<br /></>}
              {firma.firma_steuernummer && <>Steuernr.: {firma.firma_steuernummer}</>}
            </div>
          </div>
        </div>

        {/* Fahrzeugdaten */}
        <div className="fz-box">
          <div className="fz-feld"><div className="fz-label">Fahrzeug</div><div className="fz-wert">{fz.marke} {fz.modell}</div></div>
          <div className="fz-feld"><div className="fz-label">Kennzeichen</div><div className="fz-wert">{fz.kennzeichen || '—'}</div></div>
          <div className="fz-feld"><div className="fz-label">FIN / VIN</div><div className="fz-wert">{fz.fahrgestellnummer || '—'}</div></div>
          <div className="fz-feld"><div className="fz-label">Kilometerstand</div><div className="fz-wert">{fz.kilometerstand ? fz.kilometerstand.toLocaleString('de-DE') + ' km' : '—'}</div></div>
        </div>

        {/* Positionen */}
        <table>
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Beschreibung</th>
              <th>Teile-Nr.</th>
              <th className="ta-right">Menge</th>
              <th className="ta-right">Einzel (netto)</th>
              <th className="ta-right">Gesamt (netto)</th>
            </tr>
          </thead>
          <tbody>
            {/* Arbeitsleistung */}
            <tr className="section-header"><td colSpan={6}>Arbeitsleistung</td></tr>
            <tr>
              <td>1</td>
              <td>
                Reparatur- und Wartungsarbeiten<br />
                <span style={{fontSize: '9px', color: '#64748b'}}>
                  {auftrag._arbeit_stunden
                    ? `${auftrag._arbeit_stunden} Std. × ${auftrag._stundensatz} €/Std.`
                    : (auftrag.arbeiten || 'Gemäß Auftrag Nr. ' + auftrag.auftrag_nr)}
                </span>
              </td>
              <td>—</td>
              <td className="ta-right">{auftrag._arbeit_stunden ? `${auftrag._arbeit_stunden} h` : '1'}</td>
              <td className="ta-right">{auftrag._arbeit_stunden ? fmtEuro(auftrag._stundensatz ?? 0) : fmtEuro(arbeitNetto)}</td>
              <td className="ta-right">{fmtEuro(arbeitNetto)}</td>
            </tr>

            {/* Ersatzteile */}
            {teile.length > 0 && (
              <>
                <tr className="section-header"><td colSpan={6}>Ersatzteile &amp; Material</td></tr>
                {teile.map((t: any, i: number) => {
                  const ep = kleinunternehmer ? (t.einzelpreis ?? 0) : (t.einzelpreis ?? 0) / 1.19
                  const gp = ep * (t.menge ?? 1)
                  return (
                    <tr key={t.id}>
                      <td>{i + 2}</td>
                      <td>{t.bezeichnung}{t.lieferant ? ` (${t.lieferant})` : ''}</td>
                      <td style={{fontFamily:'monospace', fontSize:'9px'}}>{t.teilenummer || '—'}</td>
                      <td className="ta-right">{t.menge}x</td>
                      <td className="ta-right">{fmtEuro(ep)}</td>
                      <td className="ta-right">{fmtEuro(gp)}</td>
                    </tr>
                  )
                })}
              </>
            )}

            {/* Kleinteilpauschale */}
            {kleinteilNetto > 0 && (
              <>
                <tr className="section-header"><td colSpan={6}>Kleinteilpauschale</td></tr>
                <tr>
                  <td>{teile.length + 2}</td>
                  <td>Kleinteilpauschale (Schrauben, Dichtungen, Kleinmaterial)</td>
                  <td>—</td>
                  <td className="ta-right">1</td>
                  <td className="ta-right">{fmtEuro(kleinteilNetto)}</td>
                  <td className="ta-right">{fmtEuro(kleinteilNetto)}</td>
                </tr>
              </>
            )}

            {/* Sonstiges */}
            {sonstigesNetto > 0 && (
              <>
                <tr className="section-header"><td colSpan={6}>Sonstiges</td></tr>
                <tr>
                  <td>{teile.length + 2}</td>
                  <td>Sonstige Leistungen</td>
                  <td>—</td>
                  <td className="ta-right">1</td>
                  <td className="ta-right">{fmtEuro(sonstigesNetto)}</td>
                  <td className="ta-right">{fmtEuro(sonstigesNetto)}</td>
                </tr>
              </>
            )}

            {/* Summenzeilen */}
            <tr style={{height: '8px'}}><td colSpan={6}></td></tr>
            <tr className="summen">
              <td colSpan={5} style={{textAlign:'right', color:'#475569'}}>Zwischensumme (netto):</td>
              <td className="ta-right">{fmtEuro(gesamtNetto)}</td>
            </tr>
            {!kleinunternehmer ? (
              <>
                <tr className="summen">
                  <td colSpan={5} style={{textAlign:'right', color:'#475569'}}>zzgl. {mwstSatz}% MwSt.:</td>
                  <td className="ta-right">{fmtEuro(mwstBetrag)}</td>
                </tr>
                <tr className="gesamt">
                  <td colSpan={5} style={{textAlign:'right'}}>Gesamtbetrag (brutto):</td>
                  <td className="ta-right">{fmtEuro(gesamtBrutto)}</td>
                </tr>
              </>
            ) : (
              <>
                <tr className="gesamt">
                  <td colSpan={5} style={{textAlign:'right'}}>Gesamtbetrag:</td>
                  <td className="ta-right">{fmtEuro(gesamtBrutto)}</td>
                </tr>
                <tr className="mwst-hinweis">
                  <td colSpan={6}>Gemäß §19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* Zahlungsinfo */}
        <div className="zahlung">
          <div className="zahlung-box">
            <div className="zahlung-titel">Zahlungsinformationen</div>
            <div className="zahlung-wert">
              <strong>Zahlungsziel: {zahlungsziel.toLocaleDateString('de-DE')}</strong><br />
              Zahlung per Überweisung oder bar.<br />
              Bitte Rechnungsnummer angeben.
            </div>
          </div>
          <div className="zahlung-box">
            <div className="zahlung-titel">Bankverbindung</div>
            <div className="zahlung-wert">
              {firma.firma_bank && <>{firma.firma_bank}<br /></>}
              {firma.firma_iban && <>IBAN: <strong>{firma.firma_iban}</strong><br /></>}
              {firma.firma_bic && <>BIC: {firma.firma_bic}</>}
              {!firma.firma_iban && <span style={{color:'#94a3b8'}}>Bitte IBAN in Einstellungen eintragen</span>}
            </div>
          </div>
        </div>

        {/* Fußzeile */}
        <div className="footer">
          {firma.firma_name || 'Kfz-Werkstatt'}
          {firma.firma_strasse ? ` · ${firma.firma_strasse}, ${firma.firma_plz} ${firma.firma_ort}` : ''}
          {firma.firma_ust_id ? ` · USt-IdNr.: ${firma.firma_ust_id}` : ''}
          {firma.firma_steuernummer ? ` · Steuernr.: ${firma.firma_steuernummer}` : ''}
          <br />
          Vielen Dank für Ihr Vertrauen!
        </div>
      </div>
    </>
  )
}
