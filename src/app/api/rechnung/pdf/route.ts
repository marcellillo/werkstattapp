import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generatePDF } from '@/lib/pdf-generator'
import { resolveRechnungDetail, type RechnungPosition } from '@/lib/rechnung-detail'

function fmt(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function rowsHtml(positionen: RechnungPosition[]): string {
  return positionen.map(pos => `
    <tr>
      <td>${pos.beschreibung}</td>
      <td class="ta-right">${pos.menge}</td>
      <td class="ta-right">${fmt(pos.preis)} €</td>
      <td class="ta-right">${fmt(pos.summe)} €</td>
    </tr>`).join('')
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { rechnungId, betriebId } = await req.json()

    if (!rechnungId || !betriebId) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const { data: betriebCheck, error: checkError } = await supabase
      .from('betrieb_users')
      .select('id')
      .eq('betrieb_id', betriebId)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (checkError) throw checkError
    if (!betriebCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const detail = await resolveRechnungDetail(supabase, rechnungId, betriebId)
    if (!detail) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })

    const { rechnung, kunde, fahrzeug, firma, kleinunternehmer, ersatzteilePositionen, arbeitswertePositionen } = detail

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

    const ersatzteileSectionHtml = ersatzteilePositionen.length > 0 ? `
      <div class="section-box">
        <div class="section-titel">Ersatzteile</div>
        <table>
          <thead>
            <tr>
              <th>Artikelbezeichnung</th>
              <th class="ta-right">Menge</th>
              <th class="ta-right">Preis (netto)</th>
              <th class="ta-right">Summe (netto)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml(ersatzteilePositionen)}
            <tr class="section-summe">
              <td colspan="3" style="text-align:right;">Summe</td>
              <td class="ta-right">${fmt(detail.ersatzteileNetto)} €</td>
            </tr>
          </tbody>
        </table>
      </div>` : ''

    const ersatzteileSummenzeileHtml = ersatzteilePositionen.length > 0
      ? `<tr><td colspan="3" style="text-align:right; color:#475569;">Ersatzteile Summe:</td><td class="ta-right">${fmt(detail.ersatzteileNetto)} €</td></tr>`
      : ''

    const mwstZeileHtml = !kleinunternehmer
      ? `<tr><td colspan="3" style="text-align:right; color:#475569;">zzgl. 19% MwSt.:</td><td class="ta-right">${fmt(rechnung.betrag_mwst)} €</td></tr>
         <tr class="gesamt"><td colspan="3" style="text-align:right;">Gesamtbetrag (brutto):</td><td class="ta-right">${fmt(rechnung.betrag_brutto)} €</td></tr>`
      : `<tr class="gesamt"><td colspan="3" style="text-align:right;">Gesamtbetrag:</td><td class="ta-right">${fmt(rechnung.betrag_brutto)} €</td></tr>
         <tr><td colspan="4" class="mwst-hinweis">Gemäß §19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).</td></tr>`

    const kundeBlock = (kunde?.vorname || kunde?.nachname)
      ? `${kunde.firma ? `<strong>${kunde.firma}</strong><br>` : ''}<strong>${kunde.vorname ?? ''} ${kunde.nachname ?? ''}</strong><br>${kunde.strasse ? kunde.strasse + '<br>' : ''}${(kunde.plz || kunde.ort) ? `${kunde.plz ?? ''} ${kunde.ort ?? ''}<br>` : ''}${kunde.telefon ? 'Tel.: ' + kunde.telefon : ''}`
      : '<span style="color:#94a3b8">Kein Kunde hinterlegt</span>'

    const firmaSteuerBlock = `${firma.firma_ust_id ? `USt-IdNr.: ${firma.firma_ust_id}<br>` : ''}${firma.firma_steuernummer ? `Steuernr.: ${firma.firma_steuernummer}` : ''}`

    const bankBlock = firma.firma_iban
      ? `${firma.firma_bank ? firma.firma_bank + '<br>' : ''}IBAN: <strong>${firma.firma_iban}</strong>${firma.firma_bic ? '<br>BIC: ' + firma.firma_bic : ''}`
      : '<span style="color:#94a3b8">Bitte IBAN in Einstellungen eintragen</span>'

    const firmaFooterzeile = [
      firma.firma_name || 'Kfz-Werkstatt',
      firma.firma_strasse,
      (firma.firma_plz || firma.firma_ort) ? `${firma.firma_plz ?? ''} ${firma.firma_ort ?? ''}`.trim() : null,
      firma.firma_geschaeftsfuehrer ? `Geschäftsführung: ${firma.firma_geschaeftsfuehrer}` : null,
      firma.firma_hrb ? `HRB ${firma.firma_hrb}${firma.firma_amtsgericht ? ` Amtsgericht ${firma.firma_amtsgericht}` : ''}` : null,
      firma.firma_ust_id ? `USt-IdNr.: ${firma.firma_ust_id}` : null,
    ].filter(Boolean).join(' · ')

    const zahlungsziel = new Date(new Date(rechnung.erstellt_am).getTime() + 14 * 86_400_000).toLocaleDateString('de-DE')

    const pdfBuffer = await generatePDF('rechnung', {
      logoBase64: firma.firma_logo || '',
      betriebName: firma.firma_name || 'Kfz-Werkstatt',
      betriebAdresse: `${firma.firma_strasse || ''}, ${firma.firma_plz || ''} ${firma.firma_ort || ''}`,
      betriebTelZeile: firma.firma_telefon ? `Tel.: ${firma.firma_telefon}<br>` : '',
      betriebEmail: firma.firma_email || '',
      rechnungsNummer: rechnung.rechnungs_nr,
      datum: new Date(rechnung.erstellt_am).toLocaleDateString('de-DE'),
      kundeBlock,
      firmaSteuerBlock,
      fahrzeugMarke: fahrzeug?.marke || '',
      fahrzeugModell: fahrzeug?.modell || '',
      fahrzeugKennzeichen: fahrzeug?.kennzeichen || '—',
      fahrzeugFin: fahrzeug?.fin || '—',
      ersatzteileSectionHtml,
      arbeitswerteRowsHtml: rowsHtml(arbeitswerteAlle),
      arbeitswerteSumme: fmt(detail.arbeitNetto + detail.kleinteilNetto + detail.sonstigesNetto),
      ersatzteileSummenzeileHtml,
      summeNetto: fmt(rechnung.betrag_netto),
      mwstZeileHtml,
      zahlungsziel,
      bankBlock,
      firmaFooterzeile,
    } as any)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Rechnung_${rechnung.rechnungs_nr}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('[Rechnung PDF Export] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
