// Erzeugt das Rechnungs-PDF (gleiche Vorlage wie der Download in der App). Wird von /api/rechnung/pdf und
// vom Komplett-PDF der Auftragsmappe benutzt. Alle Texte werden maskiert (esc), siehe pdf-generator.ts.
import type { SupabaseClient } from '@supabase/supabase-js'
import { generatePDF } from '@/lib/pdf-generator'
import { zahlungszielDatum } from '@/lib/zahlung'
import { resolveRechnungDetail, type RechnungPosition, type BetriebsstoffPosition } from '@/lib/rechnung-detail'

function fmt(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function esc(s: unknown) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function fmtMenge(n: number) {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

function betriebsstoffRowsHtml(positionen: BetriebsstoffPosition[], istPauschal: boolean, startNr: number): string {
  return positionen.map((pos, i) => istPauschal ? `
    <tr>
      <td class="ta-right pos-nr">${startNr + i}</td>
      <td>${esc(pos.bezeichnung)} (${fmtMenge(pos.menge)} ${esc(pos.einheit)})</td>
    </tr>` : `
    <tr>
      <td class="ta-right pos-nr">${startNr + i}</td>
      <td>${esc(pos.bezeichnung)}</td>
      <td class="ta-right">${fmtMenge(pos.menge)} ${esc(pos.einheit)}</td>
      <td class="ta-right">${fmt(pos.preis)} € / ${esc(pos.einheit)}</td>
      <td class="ta-right">${fmt(pos.summe)} €</td>
    </tr>`).join('')
}

function rowsHtml(positionen: RechnungPosition[], istPauschal: boolean, startNr = 1): string {
  return positionen.map((pos, i) => istPauschal ? `
    <tr>
      <td class="ta-right pos-nr">${startNr + i}</td>
      <td>${esc(pos.beschreibung)}</td>
    </tr>` : `
    <tr>
      <td class="ta-right pos-nr">${startNr + i}</td>
      <td>${pos.beschreibung}</td>
      <td class="ta-right">${pos.menge}</td>
      <td class="ta-right">${fmt(pos.preis)} €</td>
      <td class="ta-right">${fmt(pos.summe)} €</td>
    </tr>`).join('')
}

/** Gibt null zurück, wenn die Rechnung im Betrieb nicht existiert. Die Betriebs-Zugehörigkeit des Aufrufers ist vorher zu prüfen. */
export async function rechnungPdfErzeugen(
  supabase: SupabaseClient,
  rechnungId: string,
  betriebId: string,
): Promise<{ buffer: Buffer; rechnungsNr: string } | null> {
  const detail = await resolveRechnungDetail(supabase, rechnungId, betriebId)
  if (!detail) return null

  const { rechnung, kunde, fahrzeug, firma, kleinunternehmer, ersatzteilePositionen, arbeitswertePositionen } = detail
  const istPauschal = rechnung.anzeige_modus === 'pauschal'

  const arbeitswerteAlle: RechnungPosition[] = [
    ...arbeitswertePositionen,
    ...(detail.kleinteilNetto > 0 ? [{
      beschreibung: 'Kleinteilpauschale (Schrauben, Dichtungen, Kleinmaterial)',
      menge: 1,
      preis: detail.kleinteilNetto,
      summe: detail.kleinteilNetto,
    }] : []),
    ...(detail.sonstigesNetto > 0 ? [{
      beschreibung: detail.sonstigesBeschreibung || 'Sonstige Leistungen',
      menge: 1,
      preis: detail.sonstigesNetto,
      summe: detail.sonstigesNetto,
    }] : []),
  ]

  const positionsHeaderHtml = istPauschal
    ? `<tr><th class="ta-right pos-nr">Pos.</th><th>Artikelbezeichnung</th></tr>`
    : `<tr>
            <th class="ta-right pos-nr">Pos.</th>
            <th>Artikelbezeichnung</th>
            <th class="ta-right">Menge</th>
            <th class="ta-right">Preis (netto)</th>
            <th class="ta-right">Summe (netto)</th>
          </tr>`
  const summenzeileColspan = istPauschal ? 1 : 4

  const ersatzteileSectionHtml = ersatzteilePositionen.length > 0 ? `
    <div class="section-box">
      <div class="section-titel">Ersatzteile</div>
      <table>
        <thead>
          ${positionsHeaderHtml}
        </thead>
        <tbody>
          ${rowsHtml(ersatzteilePositionen, istPauschal, 1)}
          <tr class="section-summe">
            <td colspan="${summenzeileColspan}" style="text-align:right;">Summe</td>
            <td class="ta-right">${fmt(detail.ersatzteileNetto)} €</td>
          </tr>
        </tbody>
      </table>
    </div>` : ''

  const ersatzteileSummenzeileHtml = ersatzteilePositionen.length > 0
    ? `<tr><td colspan="3" style="text-align:right; color:#333;">Ersatzteile Summe:</td><td class="ta-right">${fmt(detail.ersatzteileNetto)} €</td></tr>`
    : ''

  const betriebsstoffePositionen = detail.betriebsstoffePositionen
  const betriebsstoffeSectionHtml = betriebsstoffePositionen.length > 0 ? `
    <div class="section-box">
      <div class="section-titel">Betriebsstoffe</div>
      <table>
        <thead>
          ${positionsHeaderHtml}
        </thead>
        <tbody>
          ${betriebsstoffRowsHtml(betriebsstoffePositionen, istPauschal, ersatzteilePositionen.length + 1)}
          <tr class="section-summe">
            <td colspan="${summenzeileColspan}" style="text-align:right;">Summe</td>
            <td class="ta-right">${fmt(detail.betriebsstoffeNetto)} €</td>
          </tr>
        </tbody>
      </table>
    </div>` : ''

  const betriebsstoffeSummenzeileHtml = betriebsstoffePositionen.length > 0
    ? `<tr><td colspan="3" style="text-align:right; color:#333;">Betriebsstoffe Summe:</td><td class="ta-right">${fmt(detail.betriebsstoffeNetto)} €</td></tr>`
    : ''
  const lohnMaterialBetriebsstoffe =
    `Lohn (netto): <strong>${fmt(detail.arbeitNetto + detail.kleinteilNetto + detail.sonstigesNetto)} €</strong> · Material (netto): <strong>${fmt(detail.ersatzteileNetto)} €</strong>` +
    (betriebsstoffePositionen.length > 0 ? ` · Betriebsstoffe (netto): <strong>${fmt(detail.betriebsstoffeNetto)} €</strong>` : '')

  const mwstZeileHtml = !kleinunternehmer
    ? `<tr><td colspan="3" style="text-align:right; color:#333;">zzgl. 19% MwSt.:</td><td class="ta-right">${fmt(rechnung.betrag_mwst)} €</td></tr>
       <tr class="gesamt"><td colspan="3" style="text-align:right;">Gesamtbetrag (brutto):</td><td class="ta-right">${fmt(rechnung.betrag_brutto)} €</td></tr>`
    : `<tr class="gesamt"><td colspan="3" style="text-align:right;">Gesamtbetrag:</td><td class="ta-right">${fmt(rechnung.betrag_brutto)} €</td></tr>
       <tr><td colspan="4" class="mwst-hinweis">Gemäß §19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).</td></tr>`

  const kundeBlock = (kunde?.vorname || kunde?.nachname)
    ? `${kunde.firma ? `<strong>${esc(kunde.firma)}</strong><br>` : ''}<strong>${esc(kunde.vorname)} ${esc(kunde.nachname)}</strong><br>${kunde.strasse ? esc(kunde.strasse) + '<br>' : ''}${(kunde.plz || kunde.ort) ? `${esc(kunde.plz)} ${esc(kunde.ort)}<br>` : ''}${kunde.telefon ? 'Tel.: ' + esc(kunde.telefon) : ''}`
    : '<span style="color:#888">Kein Kunde hinterlegt</span>'

  const firmaSteuerBlock = `${firma.firma_ust_id ? `USt-IdNr.: ${esc(firma.firma_ust_id)}<br>` : ''}${firma.firma_steuernummer ? `Steuernr.: ${esc(firma.firma_steuernummer)}` : ''}`

  const bankBlock = firma.firma_iban
    ? `${firma.firma_bank ? esc(firma.firma_bank) + '<br>' : ''}IBAN: <strong>${esc(firma.firma_iban)}</strong>${firma.firma_bic ? '<br>BIC: ' + esc(firma.firma_bic) : ''}`
    : '<span style="color:#888">Bitte IBAN in Einstellungen eintragen</span>'

  const firmaFooterzeile = [
    firma.firma_name || 'Kfz-Werkstatt',
    firma.firma_strasse,
    (firma.firma_plz || firma.firma_ort) ? `${firma.firma_plz ?? ''} ${firma.firma_ort ?? ''}`.trim() : null,
    firma.firma_geschaeftsfuehrer ? `Geschäftsführung: ${firma.firma_geschaeftsfuehrer}` : null,
    firma.firma_hrb ? `HRB ${firma.firma_hrb}${firma.firma_amtsgericht ? ` Amtsgericht ${firma.firma_amtsgericht}` : ''}` : null,
    firma.firma_ust_id ? `USt-IdNr.: ${firma.firma_ust_id}` : null,
  ].filter(Boolean).join(' · ')

  const zahlungsziel = zahlungszielDatum(rechnung).toLocaleDateString('de-DE')

  const pdfBuffer = await generatePDF('rechnung', {
    logoBase64: firma.firma_logo || '',
    betriebName: firma.firma_name || 'Kfz-Werkstatt',
    betriebAdresse: `${firma.firma_strasse || ''}, ${firma.firma_plz || ''} ${firma.firma_ort || ''}`,
    betriebTelZeile: firma.firma_telefon ? `Tel.: ${esc(firma.firma_telefon)}<br>` : '',
    betriebEmail: firma.firma_email || '',
    rechnungsNummer: rechnung.rechnungs_nr,
    datum: new Date(rechnung.erstellt_am).toLocaleDateString('de-DE'),
    kundeBlock,
    firmaSteuerBlock,
    fahrzeugMarke: fahrzeug?.marke || '',
    fahrzeugModell: fahrzeug?.modell || '',
    fahrzeugKennzeichen: fahrzeug?.kennzeichen || '—',
    fahrzeugFin: fahrzeug?.fahrgestellnummer || '—',
    fahrzeugFarbe: fahrzeug?.farbe || '—',
    fahrzeugKm: fahrzeug?.kilometerstand != null ? `${fahrzeug.kilometerstand.toLocaleString('de-DE')} km` : '—',
    fahrzeugHu: fahrzeug?.naechste_hauptuntersuchung
      ? new Date(fahrzeug.naechste_hauptuntersuchung).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })
      : '—',
    ersatzteileSectionHtml,
    betriebsstoffeSectionHtml,
    arbeitswerteHeaderHtml: positionsHeaderHtml,
    arbeitswerteRowsHtml: rowsHtml(arbeitswerteAlle, istPauschal, ersatzteilePositionen.length + betriebsstoffePositionen.length + 1),
    arbeitswerteSummeColspan: summenzeileColspan,
    arbeitswerteSumme: fmt(detail.arbeitNetto + detail.kleinteilNetto + detail.sonstigesNetto),
    ersatzteileSummenzeileHtml,
    betriebsstoffeSummenzeileHtml,
    lohnMaterialZeileHtml: `<tr><td colspan="3" style="text-align:right; color:#333;">${lohnMaterialBetriebsstoffe}</td><td></td></tr>`,
    summeNetto: fmt(rechnung.betrag_netto),
    mwstZeileHtml,
    zahlungsziel,
    bankBlock,
    firmaFooterzeile,
  } as any)

  return { buffer: pdfBuffer, rechnungsNr: rechnung.rechnungs_nr }
}
