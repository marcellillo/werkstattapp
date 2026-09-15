'use client'
import { useEffect } from 'react'
import { FAHRZEUG_STATUS_LABEL, TEIL_STATUS_LABEL } from '@/types/database'

function fmt(date?: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtKm(km?: number | null) {
  if (!km) return '—'
  return km.toLocaleString('de-DE') + ' km'
}

function fmtEuro(n?: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function ProtokolllDruck({ auftrag, rechnungen }: { auftrag: any; rechnungen: any[] }) {
  const fz = auftrag.fahrzeug ?? {}
  const kd = auftrag.kunde ?? {}
  const teile = (auftrag.ersatzteile ?? []) as any[]
  const eingebaut = teile.filter(t => t.status === 'eingebaut')
  const teileGesamt = eingebaut.reduce((s: number, t: any) => s + (t.einzelpreis ?? 0) * (t.menge ?? 1), 0)
  const einkauf = rechnungen.reduce((s: number, r: any) => s + (r.gesamt ?? 0), 0)

  useEffect(() => {
    window.print()
  }, [])

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: white; }
        @page { size: A4; margin: 15mm 15mm 15mm 15mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .page { font-family: Arial, sans-serif; font-size: 11px; color: #111; max-width: 794px; margin: 0 auto; padding: 20px; padding-top: calc(max(10px, env(safe-area-inset-top)) + 58px); padding-bottom: max(20px, env(safe-area-inset-bottom)); }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; border-bottom: 2px solid #ea580c; padding-bottom: 12px; }
        .logo-block h1 { font-size: 20px; font-weight: 700; color: #ea580c; margin: 0 0 2px; }
        .logo-block p { font-size: 10px; color: #666; margin: 0; }
        .doc-info { text-align: right; }
        .doc-info .doc-title { font-size: 16px; font-weight: 700; color: #1e293b; }
        .doc-info .doc-nr { font-size: 11px; color: #64748b; margin-top: 3px; }
        .doc-info .doc-date { font-size: 10px; color: #94a3b8; margin-top: 2px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
        .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; }
        .section { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
        .section-header { background: #f8fafc; padding: 6px 10px; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 1px solid #e2e8f0; }
        .section-body { padding: 10px; }
        .field-row { display: flex; gap: 4px; margin-bottom: 5px; align-items: baseline; }
        .field-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; min-width: 100px; flex-shrink: 0; }
        .field-val { font-size: 11px; color: #1e293b; font-weight: 500; }
        .status-badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .status-fertig { background: #dcfce7; color: #166534; }
        .status-other { background: #fff7ed; color: #c2410c; }
        .arbeiten-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; min-height: 60px; font-size: 11px; white-space: pre-wrap; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #f1f5f9; text-align: left; padding: 5px 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; }
        td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
        tr:last-child td { border-bottom: none; }
        .tr-total td { font-weight: 700; border-top: 2px solid #e2e8f0; background: #f8fafc; }
        .ta-right { text-align: right; }
        .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px; }
        .sig-box { border-top: 1px solid #334155; padding-top: 6px; }
        .sig-label { font-size: 9px; color: #64748b; }
        .sig-space { height: 40px; }
        .footer { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #94a3b8; text-align: center; }
        .highlight-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 4px; padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; }
        .action-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 999; display: flex; align-items: center; gap: 8px; padding: 10px 16px; padding-top: max(10px, env(safe-area-inset-top)); background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-bottom: 1px solid #e2e8f0; }
        .action-bar button { padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
        .btn-back { background: white; color: #334155; border: 1px solid #e2e8f0 !important; }
        .btn-print { background: #ea580c; color: white; margin-left: auto; }
      `}</style>

      <div className="no-print action-bar">
        <button className="btn-back" onClick={() => history.back()}>← Zurück</button>
        <button className="btn-print" onClick={() => window.print()}>🖨 Drucken</button>
      </div>

      <div className="page">
        {/* Header */}
        <div className="header">
          <div className="logo-block">
            <h1>Kfz-Werkstatt</h1>
            <p>Übergabeprotokoll / Reparaturauftrag</p>
          </div>
          <div className="doc-info">
            <div className="doc-title">Übergabeprotokoll</div>
            <div className="doc-nr">Auftrag Nr. {auftrag.auftrag_nr}</div>
            <div className="doc-date">Erstellt am {fmt(new Date().toISOString())}</div>
          </div>
        </div>

        {/* Fahrzeug + Kunde */}
        <div className="grid2">
          <div className="section">
            <div className="section-header">Fahrzeugdaten</div>
            <div className="section-body">
              <div className="field-row"><span className="field-label">Marke / Modell</span><span className="field-val">{fz.marke} {fz.modell}</span></div>
              <div className="field-row"><span className="field-label">Kennzeichen</span><span className="field-val">{fz.kennzeichen ?? '—'}</span></div>
              <div className="field-row"><span className="field-label">Fahrgestellnr.</span><span className="field-val">{fz.fahrgestellnummer ?? '—'}</span></div>
              <div className="field-row"><span className="field-label">Baujahr</span><span className="field-val">{fz.baujahr ?? '—'}</span></div>
              <div className="field-row"><span className="field-label">Kilometerstand</span><span className="field-val">{fmtKm(fz.kilometerstand)}</span></div>
              <div className="field-row"><span className="field-label">Farbe</span><span className="field-val">{fz.farbe ?? '—'}</span></div>
              <div className="field-row"><span className="field-label">Motor / ccm</span><span className="field-val">{fz.motortyp ?? '—'}{fz.hubraum ? ` / ${fz.hubraum}` : ''}</span></div>
              <div className="field-row"><span className="field-label">Nächste HU</span><span className="field-val">{fmt(fz.naechste_hauptuntersuchung)}</span></div>
            </div>
          </div>

          <div className="section">
            <div className="section-header">Kundendaten</div>
            <div className="section-body">
              <div className="field-row"><span className="field-label">Name</span><span className="field-val">{kd.vorname || kd.nachname ? `${kd.vorname ?? ''} ${kd.nachname ?? ''}`.trim() : '—'}</span></div>
              {kd.firma && <div className="field-row"><span className="field-label">Firma</span><span className="field-val">{kd.firma}</span></div>}
              <div className="field-row"><span className="field-label">Telefon</span><span className="field-val">{kd.telefon ?? kd.mobil ?? '—'}</span></div>
              <div className="field-row"><span className="field-label">E-Mail</span><span className="field-val">{kd.email ?? '—'}</span></div>
              <div className="field-row"><span className="field-label">Adresse</span><span className="field-val">{kd.strasse ? `${kd.strasse}, ${kd.plz ?? ''} ${kd.ort ?? ''}` : '—'}</span></div>
            </div>
          </div>
        </div>

        {/* Auftragsdaten */}
        <div className="section">
          <div className="section-header">Auftragsdaten</div>
          <div className="section-body">
            <div className="grid3" style={{ marginBottom: 0 }}>
              <div className="field-row" style={{ flexDirection: 'column', gap: 2 }}>
                <span className="field-label">Angenommen am</span>
                <span className="field-val">{fmt(auftrag.erstellt_am)}</span>
              </div>
              <div className="field-row" style={{ flexDirection: 'column', gap: 2 }}>
                <span className="field-label">Fertiggestellt am</span>
                <span className="field-val">{fmt(auftrag.fertiggestellt_am)}</span>
              </div>
              <div className="field-row" style={{ flexDirection: 'column', gap: 2 }}>
                <span className="field-label">Status</span>
                <span className={`status-badge ${['fertig','ausgeliefert'].includes(auftrag.status) ? 'status-fertig' : 'status-other'}`}>
                  {FAHRZEUG_STATUS_LABEL[auftrag.status as keyof typeof FAHRZEUG_STATUS_LABEL] ?? auftrag.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Durchgeführte Arbeiten */}
        <div className="section">
          <div className="section-header">Durchgeführte Arbeiten / Reparaturbeschreibung</div>
          <div className="section-body">
            <div className="arbeiten-block">{auftrag.arbeiten || '—'}</div>
          </div>
        </div>

        {/* Ersatzteile */}
        {teile.length > 0 && (
          <div className="section">
            <div className="section-header">Verwendete Ersatzteile</div>
            <div className="section-body" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Bezeichnung</th>
                    <th>Teilenummer</th>
                    <th className="ta-right">Menge</th>
                    <th className="ta-right">Einzelpreis</th>
                    <th className="ta-right">Gesamt</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teile.map((t: any) => (
                    <tr key={t.id}>
                      <td>{t.bezeichnung}</td>
                      <td>{t.teilenummer ?? '—'}</td>
                      <td className="ta-right">{t.menge}</td>
                      <td className="ta-right">{fmtEuro(t.einzelpreis)}</td>
                      <td className="ta-right">{fmtEuro((t.einzelpreis ?? 0) * (t.menge ?? 1))}</td>
                      <td>{TEIL_STATUS_LABEL[t.status as keyof typeof TEIL_STATUS_LABEL] ?? t.status}</td>
                    </tr>
                  ))}
                  {teile.length > 0 && (
                    <tr className="tr-total">
                      <td colSpan={4} className="ta-right">Teile gesamt:</td>
                      <td className="ta-right">{fmtEuro(teileGesamt)}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TÜV */}
        {auftrag.tuev_kandidat && (
          <div className="section">
            <div className="section-header">TÜV / Hauptuntersuchung</div>
            <div className="section-body">
              <div className="grid3" style={{ marginBottom: 0 }}>
                <div className="field-row" style={{ flexDirection: 'column', gap: 2 }}>
                  <span className="field-label">TÜV-Termin</span>
                  <span className="field-val">{fmt(auftrag.tuev_termin)}</span>
                </div>
                <div className="field-row" style={{ flexDirection: 'column', gap: 2 }}>
                  <span className="field-label">Ergebnis</span>
                  <span className="field-val">{auftrag.tuev_ergebnis ? { bestanden: 'Bestanden ✓', nicht_bestanden: 'Nicht bestanden ✗', maengel: 'Mängel vorhanden' }[auftrag.tuev_ergebnis as string] ?? auftrag.tuev_ergebnis : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Kosten */}
        <div className="highlight-box" style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 12 }}>Gesamtbetrag (Einnahmen)</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#ea580c' }}>{fmtEuro(auftrag.einnahmen)}</span>
        </div>

        {/* Bemerkungen */}
        {auftrag.bemerkungen && (
          <div className="section">
            <div className="section-header">Bemerkungen</div>
            <div className="section-body">
              <div className="arbeiten-block">{auftrag.bemerkungen}</div>
            </div>
          </div>
        )}

        {/* Unterschriften */}
        <div className="sig-section">
          <div className="sig-box">
            <div className="sig-space"></div>
            <div className="sig-label">Datum, Unterschrift Werkstatt</div>
          </div>
          <div className="sig-box">
            <div className="sig-space"></div>
            <div className="sig-label">Datum, Unterschrift Kunde</div>
          </div>
        </div>

        <div className="footer">
          Mit meiner Unterschrift bestätige ich die ordnungsgemäße Durchführung der beschriebenen Arbeiten sowie die Abholung des Fahrzeugs in einwandfreiem Zustand.
        </div>
      </div>
    </>
  )
}
