export const runtime = 'nodejs'
// Rechnungs-PDFs (Chromium) erzeugen und Belege laden: braucht die volle Laufzeit
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { verlangeFinanzrolle } from '@/lib/rollen-server'
import { rateLimit } from '@/lib/rate-limit'
import { serverFehler } from '@/lib/api-fehler'
import { csvDatei, deDatum, deZahl } from '@/lib/csv'
import { zipErstellen, type ZipEintrag } from '@/lib/zip'
import { exportAblegen } from '@/lib/export-ablage'
import { faelligkeit, plusTage, tagBerlin } from '@/lib/zahlung'
import { berechneFahrzeugSteuer, STEUERART_LABEL, type Steuerart } from '@/lib/fahrzeug-steuer'
import { rechnungPdfErzeugen } from '@/lib/rechnung-pdf'
import { RECHNUNG_BUCKET } from '@/lib/eingangsrechnung'

const TAG = /^\d{4}-\d{2}-\d{2}$/
const MAX_PDFS = 20          // Rechnungs-PDFs je Export (jedes braucht einen Chromium-Durchlauf)
const MAX_BELEGE = 60        // Eingangsbelege je Export
const MAX_BELEG_BYTES = 8 * 1024 * 1024
const MAX_GESAMT_BYTES = 30 * 1024 * 1024
const PDF_ZEITBUDGET_MS = 38_000

const sauber = (s: string, max = 40) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max) || 'x'
const euro = (n: number) => `${deZahl(n)} EUR`

// POST /api/buchhaltung/export  { von: 'JJJJ-MM-TT', bis: 'JJJJ-MM-TT', pdfs?: boolean }
// Paket für den Steuerberater (ZIP): Ausgangsrechnungen, Eingangsrechnungen und Fahrzeugverkäufe als CSV (Excel),
// auf Wunsch die Rechnungs-PDFs und alle Eingangsbelege. Nur Administratoren und Buchhalter.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const betriebId = await getBetriebIdForUser(supabase, user.id).catch(() => null)
  if (!betriebId) return NextResponse.json({ error: 'Kein Betrieb gefunden' }, { status: 404 })
  const verboten = await verlangeFinanzrolle(supabase, user.id, betriebId)
  if (verboten) return verboten
  const limit = await rateLimit(`buchhaltung-export:${user.id}`, 8, 600)
  if (limit) return limit

  const { von, bis, pdfs } = await req.json().catch(() => ({}))
  if (!TAG.test(von ?? '') || !TAG.test(bis ?? '') || Number.isNaN(Date.parse(von + 'T00:00:00Z')) || Number.isNaN(Date.parse(bis + 'T00:00:00Z')) || bis < von) {
    return NextResponse.json({ error: 'Bitte einen gültigen Zeitraum angeben.' }, { status: 400 })
  }
  if ((Date.parse(bis + 'T00:00:00Z') - Date.parse(von + 'T00:00:00Z')) / 86_400_000 > 366) {
    return NextResponse.json({ error: 'Der Zeitraum darf höchstens ein Jahr umfassen.' }, { status: 400 })
  }

  const start = Date.now()
  try {
    const hinweise: string[] = []
    const dateien: ZipEintrag[] = []

    // ── Ausgangsrechnungen (Datum nach deutscher Zeit; die Abfrage ist großzügig, gefiltert wird danach genau) ──
    const { data: rechnungenRoh, error: reErr } = await supabase
      .from('kunden_rechnungen')
      .select('*, kunde:kunden(vorname, nachname, firma, strasse, plz, ort), fahrzeug:fahrzeuge(kennzeichen)')
      .eq('betrieb_id', betriebId)
      .gte('erstellt_am', plusTage(von, -1) + 'T00:00:00Z')
      .lte('erstellt_am', plusTage(bis, 2) + 'T00:00:00Z')
      .order('erstellt_am')
    if (reErr) throw reErr
    const rechnungen = (rechnungenRoh ?? []).filter((r: any) => { const t = tagBerlin(r.erstellt_am); return t >= von && t <= bis })
    const gueltig = rechnungen.filter((r: any) => r.status !== 'storniert')
    const summe = (liste: any[], feld: string) => liste.reduce((s, r) => s + (Number(r[feld]) || 0), 0)
    dateien.push({
      name: 'Ausgangsrechnungen.csv',
      daten: csvDatei(
        ['Rechnungsnummer', 'Rechnungsdatum', 'Kunde', 'Firma', 'Strasse', 'PLZ', 'Ort', 'Kennzeichen', 'Netto', 'MwSt', 'Brutto', 'Status', 'Faellig am', 'Bezahlt am'],
        rechnungen.map((r: any) => [
          r.rechnungs_nr, deDatum(tagBerlin(r.erstellt_am)),
          [r.kunde?.vorname, r.kunde?.nachname].filter(Boolean).join(' '), r.kunde?.firma, r.kunde?.strasse, r.kunde?.plz, r.kunde?.ort,
          r.fahrzeug?.kennzeichen, Number(r.betrag_netto) || 0, Number(r.betrag_mwst) || 0, Number(r.betrag_brutto) || 0,
          r.status, deDatum(faelligkeit(r)), deDatum(r.bezahlt_am),
        ]),
      ),
    })

    // ── Eingangsrechnungen (Lieferanten) + Belege ──
    const { data: eingang, error: eiErr } = await supabase
      .from('rechnungen')
      .select('id, lieferant, rechnungsnummer, datum, gesamt, bezahlt, bezahlt_am, faellig_am, datei_pfad, datei_name, datei_typ')
      .eq('betrieb_id', betriebId).gte('datum', von).lte('datum', bis).order('datum')
    if (eiErr) throw eiErr
    const belegName = new Map<string, string>()
    let belegBytes = 0
    const belegeEintraege: ZipEintrag[] = []
    const mitBeleg = (eingang ?? []).filter((r: any) => r.datei_pfad)
    const admin = createAdminClient()
    for (const r of mitBeleg.slice(0, MAX_BELEGE)) {
      if (belegBytes > MAX_GESAMT_BYTES) break
      const dl = await admin.storage.from(RECHNUNG_BUCKET).download(r.datei_pfad)
      if (dl.error || !dl.data) continue
      const bytes = Buffer.from(await dl.data.arrayBuffer())
      if (bytes.length > MAX_BELEG_BYTES || belegBytes + bytes.length > MAX_GESAMT_BYTES) continue
      belegBytes += bytes.length
      const ext = (/\.([A-Za-z0-9]{2,5})$/.exec(r.datei_name ?? '')?.[1] ?? (r.datei_typ?.includes('pdf') ? 'pdf' : 'jpg')).toLowerCase()
      const name = `Eingangsbelege/${r.datum ?? 'ohne-datum'}_${sauber(r.lieferant ?? 'Lieferant', 30)}_${sauber(r.rechnungsnummer ?? r.id.slice(0, 6), 30)}.${ext}`
      belegName.set(r.id, name.replace('Eingangsbelege/', ''))
      belegeEintraege.push({ name, daten: bytes })
    }
    if (mitBeleg.length > belegeEintraege.length) hinweise.push(`Von ${mitBeleg.length} Eingangsbelegen konnten ${belegeEintraege.length} beigelegt werden (Grenzen: ${MAX_BELEGE} Dateien, 8 MB je Datei, 30 MB insgesamt).`)
    dateien.push({
      name: 'Eingangsrechnungen.csv',
      daten: csvDatei(
        ['Lieferant', 'Rechnungsnummer', 'Rechnungsdatum', 'Brutto', 'Bezahlt', 'Bezahlt am', 'Faellig am', 'Beleg (Datei im Ordner Eingangsbelege)'],
        (eingang ?? []).map((r: any) => [r.lieferant, r.rechnungsnummer, deDatum(r.datum), Number(r.gesamt) || 0, !!r.bezahlt, deDatum(r.bezahlt_am), deDatum(r.faellig_am), belegName.get(r.id) ?? '']),
      ),
    })

    // ── Fahrzeugverkäufe (Eigenfahrzeuge) ──
    const { data: verkaeufeRoh } = await supabase
      .from('auftraege')
      .select('id, einnahmen, erstellt_am, verkauft_am, steuerart, kaeufer_name, status, fahrzeug:fahrzeuge(kennzeichen, marke, modell, fahrgestellnummer, fahrzeug_typ, einkaufspreis)')
      .eq('betrieb_id', betriebId).not('einnahmen', 'is', null).gt('einnahmen', 0)
    const verkaeufe = (verkaeufeRoh ?? []).filter((a: any) => {
      if (a.fahrzeug?.fahrzeug_typ !== 'eigen') return false
      const t = tagBerlin(a.verkauft_am ?? a.erstellt_am)
      return t >= von && t <= bis
    }).sort((a: any, b: any) => String(a.verkauft_am ?? a.erstellt_am).localeCompare(String(b.verkauft_am ?? b.erstellt_am)))
    let verkaufMwst = 0
    dateien.push({
      name: 'Fahrzeugverkaeufe.csv',
      daten: csvDatei(
        ['Verkaufsdatum', 'Fahrzeug', 'Kennzeichen', 'FIN', 'Kaeufer', 'Besteuerung', 'Verkaufspreis', 'Einkaufspreis', 'Marge', 'MwSt abzufuehren'],
        verkaeufe.map((a: any) => {
          const s = berechneFahrzeugSteuer({ verkaufspreis: a.einnahmen, einkaufspreis: a.fahrzeug?.einkaufspreis, steuerart: a.steuerart })
          verkaufMwst += s.mwst
          return [deDatum(tagBerlin(a.verkauft_am ?? a.erstellt_am)), [a.fahrzeug?.marke, a.fahrzeug?.modell].filter(Boolean).join(' '), a.fahrzeug?.kennzeichen, a.fahrzeug?.fahrgestellnummer,
            a.kaeufer_name, STEUERART_LABEL[(a.steuerart ?? 'differenz') as Steuerart], Number(a.einnahmen) || 0, Number(a.fahrzeug?.einkaufspreis) || 0, s.marge, s.mwst]
        }),
      ),
    })

    // ── Rechnungs-PDFs (optional) ──
    let pdfAnzahl = 0
    if (pdfs === true) {
      const kandidaten = gueltig.slice(0, MAX_PDFS)
      for (const r of kandidaten) {
        if (Date.now() - start > PDF_ZEITBUDGET_MS) break
        const pdf = await rechnungPdfErzeugen(supabase, r.id, betriebId).catch(() => null)
        if (!pdf) continue
        dateien.push({ name: `Ausgangsrechnungen/${sauber(pdf.rechnungsNr || r.rechnungs_nr, 30)}.pdf`, daten: pdf.buffer })
        pdfAnzahl++
      }
      if (gueltig.length > pdfAnzahl) hinweise.push(`Von ${gueltig.length} Rechnungen sind ${pdfAnzahl} als PDF beigelegt (je Export höchstens ${MAX_PDFS} und eine begrenzte Rechenzeit) — für den Rest einen kürzeren Zeitraum wählen.`)
    }
    dateien.push(...belegeEintraege)

    const summen = { netto: summe(gueltig, 'betrag_netto'), mwst: summe(gueltig, 'betrag_mwst'), brutto: summe(gueltig, 'betrag_brutto') }
    const eingangSumme = (eingang ?? []).reduce((s: number, r: any) => s + (Number(r.gesamt) || 0), 0)
    dateien.unshift({
      name: 'LIESMICH.txt',
      daten: [
        `Buchhaltungs-Export ${deDatum(von)} bis ${deDatum(bis)}`,
        `Erstellt am ${deDatum(tagBerlin())}`, '',
        'Inhalt',
        '  Ausgangsrechnungen.csv  Rechnungen an Kunden (inkl. stornierter, erkennbar am Status). Summen unten ohne stornierte.',
        '  Eingangsrechnungen.csv  Rechnungen von Lieferanten; Spalte "Beleg" nennt die Datei im Ordner Eingangsbelege.',
        '  Fahrzeugverkaeufe.csv   Verkaeufe von Eigenfahrzeugen mit Besteuerungsart, Marge und abzufuehrender MwSt.',
        pdfs === true ? '  Ausgangsrechnungen/     Rechnungen als PDF.' : '  (Rechnungs-PDFs wurden nicht angefordert.)',
        '  Eingangsbelege/         Original-Belege der Lieferanten.', '',
        'Format der CSV-Dateien: Semikolon als Trennzeichen, Dezimalkomma, Datum TT.MM.JJJJ, Zeichensatz UTF-8 (Excel oeffnet sie direkt).',
        'Hinweis: Dies ist KEIN DATEV-Buchungsstapel, sondern eine uebersichtliche Aufstellung zur Weitergabe.', '',
        'Summen',
        `  Ausgangsrechnungen: ${gueltig.length} Stueck, netto ${euro(summen.netto)}, MwSt ${euro(summen.mwst)}, brutto ${euro(summen.brutto)}`,
        `  Eingangsrechnungen: ${(eingang ?? []).length} Stueck, brutto ${euro(eingangSumme)}`,
        `  Fahrzeugverkaeufe:  ${verkaeufe.length} Stueck, abzufuehrende MwSt ${euro(verkaufMwst)}`,
        ...(hinweise.length ? ['', 'Hinweise', ...hinweise.map(h => '  ' + h)] : []),
      ].join('\r\n') + '\r\n',
    })

    const zip = zipErstellen(dateien)
    const dateiname = `Buchhaltung_${von}_bis_${bis}.zip`
    const { downloadUrl } = await exportAblegen(betriebId, dateiname, zip)
    return NextResponse.json({
      downloadUrl, dateiname, groesse: zip.length,
      ausgang: { anzahl: gueltig.length, storniert: rechnungen.length - gueltig.length, ...summen },
      eingang: { anzahl: (eingang ?? []).length, summe: eingangSumme, belege: belegeEintraege.length },
      fahrzeugverkaeufe: verkaeufe.length,
      pdfs: pdfAnzahl,
      hinweise,
    })
  } catch (e) {
    return serverFehler(e, 'buchhaltung/export')
  }
}
