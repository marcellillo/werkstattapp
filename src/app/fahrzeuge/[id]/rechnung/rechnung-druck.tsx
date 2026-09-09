'use client'
import { useEffect, useState } from 'react'
import { useQrDataUrl } from '@/components/ui/qr-code'
import { buildGiroCode } from '@/lib/girocode'
import type { RechnungDetail } from '@/lib/rechnung-detail'

function fmt(date?: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtEuro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

type EmailStatus = 'idle' | 'senden' | 'ok' | 'fehler'

function EmailModal({
  detail, betriebId, onClose,
}: { detail: RechnungDetail; betriebId: string; onClose: () => void }) {
  const kd = detail.kunde ?? {}
  const [an, setAn] = useState(kd.email ?? '')
  const [nachricht, setNachricht] = useState('')
  const [status, setStatus] = useState<EmailStatus>('idle')
  const [fehlerMsg, setFehlerMsg] = useState('')

  async function senden() {
    if (!an.trim()) return
    setStatus('senden')
    setFehlerMsg('')
    try {
      const res = await fetch('/api/rechnung-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rechnungId: detail.rechnung.id, betriebId, an: an.trim(), nachricht: nachricht.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Senden')
      setStatus('ok')
    } catch (e: any) {
      setFehlerMsg(e.message)
      setStatus('fehler')
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        {status === 'ok' ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#15803d', marginBottom: '6px' }}>Rechnung gesendet!</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>{detail.rechnung.rechnungs_nr} wurde an <strong>{an}</strong> gesendet.</div>
            <button onClick={onClose} style={{ background: '#1e293b', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Schließen</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>Rechnung per E-Mail senden</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{detail.rechnung.rechnungs_nr}</div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#94a3b8', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>An (E-Mail-Adresse)</label>
              <input
                type="email"
                value={an}
                onChange={e => setAn(e.target.value)}
                placeholder="kunde@beispiel.de"
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '9px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>
                Persönliche Nachricht <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={nachricht}
                onChange={e => setNachricht(e.target.value)}
                placeholder="z.B. Vielen Dank für Ihren Besuch heute …"
                rows={3}
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '9px 12px', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {fehlerMsg && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#dc2626', marginBottom: '14px' }}>
                ⚠ {fehlerMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={onClose} style={{ flex: 1, background: 'none', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px', fontSize: '14px', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
                Abbrechen
              </button>
              <button
                onClick={senden}
                disabled={!an.trim() || status === 'senden'}
                style={{ flex: 2, background: an.trim() ? '#ea580c' : '#e2e8f0', color: an.trim() ? 'white' : '#94a3b8', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '14px', fontWeight: 700, cursor: an.trim() ? 'pointer' : 'default', transition: 'background 0.15s' }}
              >
                {status === 'senden' ? 'Wird gesendet …' : '✉ Rechnung senden'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function RechnungDruck({ rechnungId, betriebId, firma: firmaHint }: { rechnungId: string; betriebId: string; firma?: Record<string, string> }) {
  const [detail, setDetail] = useState<RechnungDetail | null>(null)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [emailModalOffen, setEmailModalOffen] = useState(false)

  useEffect(() => {
    let abgebrochen = false
    fetch('/api/rechnung/detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rechnungId, betriebId }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (abgebrochen) return
        if (!ok) { setLadeFehler(data.error || 'Rechnung konnte nicht geladen werden'); return }
        setDetail(data)
      })
      .catch(e => { if (!abgebrochen) setLadeFehler(e.message) })
    return () => { abgebrochen = true }
  }, [rechnungId, betriebId])

  useEffect(() => {
    if (detail) window.print()
  }, [detail])

  // Eigener Seitentitel statt des generischen App-Titels, u.a. damit der
  // vom Browser beim Drucken/„Als PDF speichern" eingefügte Kopf-/Fußzeilentext
  // (Titel + URL) wenigstens den richtigen Firmennamen zeigt. Die URL selbst
  // kann eine Webseite nicht unterdrücken — das lässt sich nur im Druckdialog
  // unter "Kopf- und Fußzeilen" abschalten.
  useEffect(() => {
    if (detail) document.title = `Rechnung ${detail.rechnung.rechnungs_nr} – ${detail.firma.firma_name || 'Kfz-Werkstatt'}`
  }, [detail])

  // Hooks müssen unabhängig vom Ladezustand in gleicher Reihenfolge aufgerufen werden
  const firmaSafe = detail?.firma
  const giroCode = firmaSafe?.firma_iban
    ? buildGiroCode({
        bic: firmaSafe.firma_bic,
        name: firmaSafe.firma_name || 'Werkstatt',
        iban: firmaSafe.firma_iban,
        betrag: undefined,
        verwendungszweck: `Rechnung ${detail?.rechnung.rechnungs_nr ?? ''}`,
      })
    : null
  const giroQr = useQrDataUrl(giroCode ?? '')
  const paypalQr = useQrDataUrl(firmaSafe?.firma_paypal ?? '')
  const sumupQr = useQrDataUrl(firmaSafe?.firma_sumup ?? '')
  const stripeQr = useQrDataUrl(firmaSafe?.firma_stripe ?? '')

  if (ladeFehler) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{ladeFehler}</div>
  }
  if (!detail) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Wird geladen...</div>
  }

  const { rechnung, kunde: kd, fahrzeug: fz, firma, kleinunternehmer, ersatzteilePositionen, arbeitswertePositionen } = detail
  const mwstSatz = kleinunternehmer ? 0 : 19
  const istPauschal = rechnung.anzeige_modus === 'pauschal'

  const zahlungsziel = new Date(new Date(rechnung.erstellt_am).getTime() + 14 * 86_400_000)

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: white; font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; }
        @page { size: A4; margin: 18mm 15mm 18mm 20mm; }
        @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        .page { max-width: 794px; margin: 0 auto; padding: 20px; }

        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
        .firma-name { font-size: 17px; font-weight: 700; color: #ea580c; }
        .firma-details { font-size: 9.5px; color: #555; margin-top: 3px; line-height: 1.55; }
        .rechnung-block { text-align: right; }
        .rechnung-titel { font-size: 20px; font-weight: 700; color: #1e293b; }
        .rechnung-nr { font-size: 11px; color: #64748b; margin-top: 3px; }
        .rechnung-datum { font-size: 9.5px; color: #94a3b8; margin-top: 2px; }

        .trennlinie { border: none; border-top: 2px solid #ea580c; margin: 10px 0; }

        .adressen { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px; }
        .adresse-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 4px; }
        .adresse-wert { font-size: 10.5px; line-height: 1.6; }
        .adresse-wert strong { font-size: 11px; }

        .fz-box { background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 7px; padding: 8px 12px; margin-bottom: 14px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
        .fz-feld { border-right: 1px solid #e2e8f0; padding-right: 6px; }
        .fz-feld:last-child { border-right: none; }
        .fz-label { font-size: 7.5px; text-transform: uppercase; color: #64748b; letter-spacing: 0.06em; font-weight: 700; }
        .fz-wert { font-size: 10.5px; font-weight: 700; color: #0f172a; margin-top: 2px; }

        .absenderzeile { font-size: 7.5px; font-style: italic; color: #94a3b8; margin-bottom: 8px; }

        .section-box { margin-bottom: 14px; border: 1.5px solid #cbd5e1; border-radius: 7px; overflow: hidden; }
        .section-titel { background: #1e293b; color: white; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
        thead tr { background: #f1f5f9; }
        th { padding: 6px 8px; text-align: left; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
        th.ta-right { text-align: right; }
        td { padding: 5px 8px; font-size: 9.5px; border-bottom: 1px solid #f1f5f9; }
        td.ta-right { text-align: right; }
        tr.section-summe td { font-weight: 700; font-size: 10px; border-top: 1.5px solid #cbd5e1; background: #f8fafc; }
        tr.summen td { padding: 4px 8px; font-size: 10.5px; }
        tr.gesamt td { font-weight: 700; font-size: 12px; border-top: 2px solid #1e293b; background: #f8fafc; }
        tr.mwst-hinweis td { font-size: 8.5px; color: #64748b; font-style: italic; padding: 6px 8px; }

        .zahlung { display: grid; gap: 12px; margin-top: 14px; }
        .zahlung-2 { grid-template-columns: 1fr 1fr; }
        .zahlung-3 { grid-template-columns: 1fr 1fr auto; }
        .zahlung-box { background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 7px; padding: 10px 13px; }
        .zahlung-titel { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.06em; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
        .zahlung-wert { font-size: 10.5px; line-height: 1.75; }
        .zahlung-wert strong { color: #ea580c; }
        .qr-box { background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 7px; padding: 10px 13px; display: flex; flex-direction: column; gap: 8px; }
        .qr-item { display: flex; align-items: center; gap: 8px; }
        .qr-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; }
        .qr-hint { font-size: 7.5px; color: #94a3b8; line-height: 1.35; margin-top: 1px; }

        .footer { margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 8.5px; color: #94a3b8; text-align: center; line-height: 1.6; }

        .action-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 999; display: flex; align-items: center; gap: 8px; padding: 10px 12px; padding-top: max(10px, env(safe-area-inset-top)); background: rgba(255,255,255,0.96); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid #e2e8f0; }
        .action-bar button, .action-bar a { padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; white-space: nowrap; }
        .btn-back { background: #f1f5f9; color: #334155; }
        .btn-print { background: #ea580c; color: white; }
        .btn-wa { background: #16a34a; color: white; }
        .btn-email { background: #2563eb; color: white; }
        .page { padding-top: calc(max(10px, env(safe-area-inset-top)) + 60px); padding-bottom: max(20px, env(safe-area-inset-bottom)); }
      `}</style>

      <div className="no-print action-bar">
        <button className="btn-back" onClick={() => history.back()}>← Zurück</button>
        <button className="btn-print" onClick={() => window.print()}>🖨 PDF</button>
        <button
          className="btn-wa"
          onClick={() => {
            const tel = kd?.telefon?.replace(/\D/g, '') ?? ''
            const msg = encodeURIComponent(
              `Guten Tag ${kd?.vorname ?? ''} ${kd?.nachname ?? ''},\n\nIhre Rechnung Nr. ${rechnung.rechnungs_nr} liegt vor.\nGesamtbetrag: ${fmtEuro(rechnung.betrag_brutto)}\nZahlungsziel: ${zahlungsziel.toLocaleDateString('de-DE')}\n\nBitte Rechnungsnummer ${rechnung.rechnungs_nr} bei Überweisung angeben.${firma.firma_telefon ? `\n\nBei Fragen: ${firma.firma_telefon}` : ''}`
            )
            const url = tel ? `https://wa.me/${tel}?text=${msg}` : `https://wa.me/?text=${msg}`
            window.open(url, '_blank')
          }}
        >📱 WhatsApp</button>
        <button className="btn-email" onClick={() => setEmailModalOffen(true)}>✉ E-Mail</button>
      </div>
      {emailModalOffen && <EmailModal detail={detail} betriebId={betriebId} onClose={() => setEmailModalOffen(false)} />}

      <div className="page">
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
            <div className="rechnung-nr">Nr. {rechnung.rechnungs_nr}</div>
            <div className="rechnung-datum">Datum: {fmt(rechnung.erstellt_am)}</div>
          </div>
        </div>

        <hr className="trennlinie" />

        <div className="absenderzeile">
          {firma.firma_name || 'Kfz-Werkstatt'}
          {firma.firma_strasse ? `, ${firma.firma_strasse}` : ''}
          {(firma.firma_plz || firma.firma_ort) ? `, ${firma.firma_plz} ${firma.firma_ort}` : ''}
        </div>

        <div className="adressen">
          <div className="adresse-box">
            <div className="adresse-label">Rechnungsempfänger</div>
            <div className="adresse-wert">
              {(kd?.vorname || kd?.nachname) ? (
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

        <div className="fz-box">
          <div className="fz-feld"><div className="fz-label">Fahrzeug</div><div className="fz-wert">{fz?.marke} {fz?.modell}</div></div>
          <div className="fz-feld"><div className="fz-label">Kennzeichen</div><div className="fz-wert">{fz?.kennzeichen || '—'}</div></div>
          <div className="fz-feld"><div className="fz-label">FIN / VIN</div><div className="fz-wert">{fz?.fin || fz?.fahrgestellnummer || '—'}</div></div>
          <div className="fz-feld"><div className="fz-label">Kilometerstand</div><div className="fz-wert">{fz?.kilometerstand ? fz.kilometerstand.toLocaleString('de-DE') + ' km' : '—'}</div></div>
        </div>

        {/* Ersatzteile — eigene Box */}
        {ersatzteilePositionen.length > 0 && (
          <div className="section-box">
            <div className="section-titel">Ersatzteile</div>
            <table>
              <thead>
                <tr>
                  <th>Artikelbezeichnung</th>
                  {!istPauschal && <th className="ta-right">Menge</th>}
                  {!istPauschal && <th className="ta-right">Preis (netto)</th>}
                  {!istPauschal && <th className="ta-right">Summe (netto)</th>}
                </tr>
              </thead>
              <tbody>
                {ersatzteilePositionen.map((pos, i) => (
                  <tr key={i}>
                    <td>{pos.beschreibung}</td>
                    {!istPauschal && <td className="ta-right">{pos.menge}x</td>}
                    {!istPauschal && <td className="ta-right">{fmtEuro(pos.preis)}</td>}
                    {!istPauschal && <td className="ta-right">{fmtEuro(pos.summe)}</td>}
                  </tr>
                ))}
                <tr className="section-summe">
                  <td colSpan={istPauschal ? 1 : 3} style={{textAlign: 'right'}}>Summe</td>
                  <td className="ta-right">{fmtEuro(detail.ersatzteileNetto)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Arbeitswerte — eigene Box */}
        <div className="section-box">
          <div className="section-titel">Arbeitswerte</div>
          <table>
            <thead>
              <tr>
                <th>Bezeichnung</th>
                {!istPauschal && <th className="ta-right">Menge</th>}
                {!istPauschal && <th className="ta-right">Einzelpreis</th>}
                {!istPauschal && <th className="ta-right">Summe (netto)</th>}
              </tr>
            </thead>
            <tbody>
              {arbeitswertePositionen.length === 0 && detail.kleinteilNetto <= 0 && detail.sonstigesNetto <= 0 ? (
                <tr><td colSpan={istPauschal ? 1 : 4} style={{color: '#94a3b8', fontStyle: 'italic'}}>Keine Arbeitszeit erfasst</td></tr>
              ) : (
                arbeitswertePositionen.map((pos, i) => (
                  <tr key={i}>
                    <td>{pos.beschreibung}</td>
                    {!istPauschal && <td className="ta-right">{pos.menge}</td>}
                    {!istPauschal && <td className="ta-right">{fmtEuro(pos.preis)}</td>}
                    {!istPauschal && <td className="ta-right">{fmtEuro(pos.summe)}</td>}
                  </tr>
                ))
              )}
              {detail.kleinteilNetto > 0 && (
                <tr>
                  <td>Kleinteilpauschale (Schrauben, Dichtungen, Kleinmaterial)</td>
                  {!istPauschal && <td className="ta-right">1</td>}
                  {!istPauschal && <td className="ta-right">{fmtEuro(detail.kleinteilNetto)}</td>}
                  {!istPauschal && <td className="ta-right">{fmtEuro(detail.kleinteilNetto)}</td>}
                </tr>
              )}
              {detail.sonstigesNetto > 0 && (
                <tr>
                  <td>{detail.sonstigesBeschreibung || 'Sonstige Leistungen'}</td>
                  {!istPauschal && <td className="ta-right">1</td>}
                  {!istPauschal && <td className="ta-right">{fmtEuro(detail.sonstigesNetto)}</td>}
                  {!istPauschal && <td className="ta-right">{fmtEuro(detail.sonstigesNetto)}</td>}
                </tr>
              )}
              <tr className="section-summe">
                <td colSpan={istPauschal ? 1 : 3} style={{textAlign: 'right'}}>Summe</td>
                <td className="ta-right">{fmtEuro(detail.arbeitNetto + detail.kleinteilNetto + detail.sonstigesNetto)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Gesamtsummen */}
        <table>
          <tbody>
            {ersatzteilePositionen.length > 0 && (
              <tr className="summen">
                <td colSpan={3} style={{textAlign:'right', color:'#475569'}}>Ersatzteile Summe:</td>
                <td className="ta-right">{fmtEuro(detail.ersatzteileNetto)}</td>
              </tr>
            )}
            <tr className="summen">
              <td colSpan={3} style={{textAlign:'right', color:'#475569'}}>Arbeitsaufwand Summe:</td>
              <td className="ta-right">{fmtEuro(detail.arbeitNetto + detail.kleinteilNetto + detail.sonstigesNetto)}</td>
            </tr>
            <tr className="summen">
              <td colSpan={3} style={{textAlign:'right', color:'#475569'}}>Netto-Gesamtbetrag:</td>
              <td className="ta-right">{fmtEuro(rechnung.betrag_netto)}</td>
            </tr>
            {!kleinunternehmer ? (
              <>
                <tr className="summen">
                  <td colSpan={3} style={{textAlign:'right', color:'#475569'}}>zzgl. {mwstSatz}% MwSt.:</td>
                  <td className="ta-right">{fmtEuro(rechnung.betrag_mwst)}</td>
                </tr>
                <tr className="gesamt">
                  <td colSpan={3} style={{textAlign:'right'}}>Gesamtbetrag (brutto):</td>
                  <td className="ta-right">{fmtEuro(rechnung.betrag_brutto)}</td>
                </tr>
              </>
            ) : (
              <>
                <tr className="gesamt">
                  <td colSpan={3} style={{textAlign:'right'}}>Gesamtbetrag:</td>
                  <td className="ta-right">{fmtEuro(rechnung.betrag_brutto)}</td>
                </tr>
                <tr className="mwst-hinweis">
                  <td colSpan={4}>Gemäß §19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        <div className={`zahlung ${(giroQr || paypalQr || sumupQr || stripeQr) ? 'zahlung-3' : 'zahlung-2'}`}>
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
          {(giroQr || paypalQr || sumupQr || stripeQr) && (
            <div className="qr-box">
              <div className="zahlung-titel" style={{marginBottom: 6}}>Jetzt bezahlen</div>
              {giroQr && (
                <div className="qr-item">
                  <img src={giroQr} alt="GiroCode" style={{width: 48, height: 48, borderRadius: 3, flexShrink: 0}} />
                  <div>
                    <div className="qr-label">Überweisung</div>
                    <div className="qr-hint">Banking-App scannen</div>
                  </div>
                </div>
              )}
              {paypalQr && (
                <div className="qr-item">
                  <img src={paypalQr} alt="PayPal" style={{width: 48, height: 48, borderRadius: 3, flexShrink: 0}} />
                  <div>
                    <div className="qr-label">PayPal</div>
                    <div className="qr-hint">Kamera scannen</div>
                  </div>
                </div>
              )}
              {sumupQr && (
                <div className="qr-item">
                  <img src={sumupQr} alt="SumUp" style={{width: 48, height: 48, borderRadius: 3, flexShrink: 0}} />
                  <div>
                    <div className="qr-label">SumUp</div>
                    <div className="qr-hint">Karte / Apple Pay</div>
                  </div>
                </div>
              )}
              {stripeQr && (
                <div className="qr-item">
                  <img src={stripeQr} alt="Stripe" style={{width: 48, height: 48, borderRadius: 3, flexShrink: 0}} />
                  <div>
                    <div className="qr-label">Stripe</div>
                    <div className="qr-hint">Karte / Apple Pay</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="footer">
          {firma.firma_name || 'Kfz-Werkstatt'}
          {firma.firma_strasse ? ` · ${firma.firma_strasse}` : ''}
          {(firma.firma_plz || firma.firma_ort) ? ` · ${firma.firma_plz} ${firma.firma_ort}` : ''}
          {firma.firma_geschaeftsfuehrer ? ` · Geschäftsführung: ${firma.firma_geschaeftsfuehrer}` : ''}
          {firma.firma_hrb ? ` · HRB ${firma.firma_hrb}${firma.firma_amtsgericht ? ` Amtsgericht ${firma.firma_amtsgericht}` : ''}` : ''}
          {firma.firma_ust_id ? ` · USt-IdNr.: ${firma.firma_ust_id}` : ''}
          {firma.firma_steuernummer ? ` · Steuernr.: ${firma.firma_steuernummer}` : ''}
          {firma.firma_iban ? ` · IBAN ${firma.firma_iban}` : ''}
          {firma.firma_telefon ? ` · Tel. ${firma.firma_telefon}` : ''}
          {firma.firma_email ? ` · ${firma.firma_email}` : ''}
          <br />
          Vielen Dank für Ihr Vertrauen!
        </div>
      </div>
    </>
  )
}
