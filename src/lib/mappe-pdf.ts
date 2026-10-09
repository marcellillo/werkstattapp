// Komplett-PDF der Auftragsmappe: Deckblatt (Kunde, Fahrzeug, Arbeiten, Teile, Rechnungen) mit ANKLICKBAREM
// Inhaltsverzeichnis, danach alle Rechnungen, Dokumente & Dateien (PDF-Seiten bzw. Bilder), Lieferanten-Belege
// und Fotos als Seiten. Jede Datei hat ein Lesezeichen (Seitenleiste des PDF-Programms) und die Originale von
// Dokumenten und Belegen sind zusätzlich als Dateianhänge (Büroklammer) eingebettet -> jede Datei lässt sich
// einzeln öffnen bzw. unverändert herausspeichern.
import { PDFDocument, PDFFont, PDFHexString, PDFName, PDFNumber, PDFPage, PDFRef, StandardFonts, rgb } from 'pdf-lib'
import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveFirmaSettings } from '@/lib/firma-settings'
import { rechnungPdfErzeugen } from '@/lib/rechnung-pdf'
import { DOKUMENT_BUCKET, DOKUMENT_KATEGORIEN, bereinigeDokumentName } from '@/lib/auftrag-dokumente'
import { BELEG_BUCKETS, speicherOrt } from '@/lib/datei-urls'

// ── Grenzen (Speicher/Laufzeit der Serverfunktion schützen) ──
const MAX_EINZELDATEI = 30 * 1024 * 1024
const MAX_GESAMT_EINGANG = 90 * 1024 * 1024
const MAX_SEITEN = 1500
const MAX_FOTOS = 80
const MAX_ANHANG_GESAMT = 22 * 1024 * 1024

const A4B = 595.28
const A4H = 841.89
const RAND = 42
const GRAU = rgb(0.42, 0.42, 0.42)
const DUNKEL = rgb(0.1, 0.1, 0.1)
const ORANGE = rgb(0.85, 0.33, 0.04)
const LINIE = rgb(0.82, 0.82, 0.82)
const BLAU = rgb(0.1, 0.3, 0.75)

const STATUS_LABEL: Record<string, string> = {
  angenommen: 'Angenommen', diagnose: 'Diagnose', reparatur: 'In Arbeit', warten_teile: 'Warten auf Teile',
  fertig: 'Fertig', verkauft: 'Verkauft', ausgeliefert: 'Ausgeliefert', storniert: 'Storniert',
}
const TEIL_STATUS: Record<string, string> = {
  nicht_bestellt: 'Nicht bestellt', bestellt: 'Bestellt', unterwegs: 'Unterwegs', geliefert: 'Geliefert', eingebaut: 'Eingebaut',
}
const RECHNUNG_STATUS: Record<string, string> = { offen: 'Offen', bezahlt: 'Bezahlt', storniert: 'Storniert', mahnung: 'Mahnung' }
const FOTO_KAT: Record<string, string> = {
  annahme: 'Annahme', reparatur: 'Reparatur', fertig: 'Fertig', allgemein: 'Allgemein', fahrzeugschein: 'Fahrzeugschein', tuev: 'TÜV-Bericht',
}
const ZUSTAND: Record<string, string> = { sehr_gut: 'Sehr gut', gut: 'Gut', maessig: 'Mäßig', schlecht: 'Schlecht' }

const datum = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const euro = (n?: number | null) => (n == null ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €')

// ───────────────────────── Datenmodell des Inhaltsverzeichnisses ─────────────────────────
interface Eintrag {
  gruppe: string          // Überschrift im Inhaltsverzeichnis / oberste Lesezeichen-Ebene
  titel: string
  start: number           // 0-basierte Seite im Rumpf (ohne Deckblatt)
  anzahl: number
}
interface Anhang { name: string; bytes: Uint8Array; mime: string; beschreibung: string }

export interface MappeErgebnis {
  bytes: Uint8Array
  seiten: number
  dateien: number         // eingefügte Dateien (Dokumente, Belege, Rechnungen)
  fotos: number
  angehaengt: number      // als Dateianhang eingebettete Originale
  hinweise: string[]
  auftragNr: string
}

// ───────────────────────── Hilfen: Text ─────────────────────────
class Textmass {
  private erlaubt: Set<number>
  constructor(public font: PDFFont, public fett: PDFFont) {
    this.erlaubt = new Set(font.getCharacterSet())
  }
  /** Zeichen, die die Standardschrift (WinAnsi) nicht kennt, ersetzen — sonst bricht pdf-lib ab. */
  sicher(s: unknown): string {
    const roh = String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\t ]/g, ' ')
    let aus = ''
    for (const z of roh) {
      const cp = z.codePointAt(0)!
      if (z === '\n') aus += '\n'
      else if (cp === 0x2192) aus += '->'
      else if (cp === 0x2713 || cp === 0x2714) aus += 'ok'
      else if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) aus += ''
      else if (this.erlaubt.has(cp)) aus += z
      else if (cp >= 0x1f000 || cp === 0xfe0f || cp === 0x200d) aus += ''
      else aus += '?'
    }
    return aus
  }
  breite(text: string, size: number, fett = false) {
    return (fett ? this.fett : this.font).widthOfTextAtSize(text, size)
  }
  kuerzen(text: string, maxB: number, size: number, fett = false) {
    const t = this.sicher(text).replace(/\n/g, ' ')
    if (this.breite(t, size, fett) <= maxB) return t
    let k = t
    while (k.length > 1 && this.breite(k + '…', size, fett) > maxB) k = k.slice(0, -1)
    return k + '…'
  }
  umbruch(text: string, size: number, maxB: number, fett = false): string[] {
    const zeilen: string[] = []
    for (const absatz of this.sicher(text).split('\n')) {
      if (!absatz.trim()) { zeilen.push(''); continue }
      let aktuell = ''
      for (const wort of absatz.split(' ')) {
        const probe = aktuell ? aktuell + ' ' + wort : wort
        if (this.breite(probe, size, fett) <= maxB) { aktuell = probe; continue }
        if (aktuell) zeilen.push(aktuell)
        // sehr lange Wörter hart trennen
        let rest = wort
        while (this.breite(rest, size, fett) > maxB && rest.length > 1) {
          let n = rest.length
          while (n > 1 && this.breite(rest.slice(0, n), size, fett) > maxB) n--
          zeilen.push(rest.slice(0, n))
          rest = rest.slice(n)
        }
        aktuell = rest
      }
      zeilen.push(aktuell)
    }
    return zeilen
  }
}

// ───────────────────────── Deckblatt ─────────────────────────
interface Link { seite: number; rect: [number, number, number, number]; ziel: number }
interface MappeDaten {
  auftrag: any
  firma: Record<string, string>
  rechnungen: any[]
  teile: any[]
}

class Schreiber {
  seite!: PDFPage
  y = 0
  links: Link[] = []
  constructor(public doc: PDFDocument, public t: Textmass) { this.neueSeite() }
  get seitenIndex() { return this.doc.getPageCount() - 1 }
  neueSeite() { this.seite = this.doc.addPage([A4B, A4H]); this.y = A4H - RAND }
  platz(h: number) { if (this.y - h < RAND + 20) this.neueSeite() }
  text(s: string, x: number, size = 10, opt: { fett?: boolean; farbe?: any } = {}) {
    this.seite.drawText(this.t.sicher(s).replace(/\n/g, ' '), { x, y: this.y, size, font: opt.fett ? this.t.fett : this.t.font, color: opt.farbe ?? DUNKEL })
  }
  rechts(s: string, xRechts: number, size = 10, opt: { fett?: boolean; farbe?: any } = {}) {
    const t = this.t.sicher(s).replace(/\n/g, ' ')
    this.seite.drawText(t, { x: xRechts - this.t.breite(t, size, opt.fett), y: this.y, size, font: opt.fett ? this.t.fett : this.t.font, color: opt.farbe ?? DUNKEL })
  }
  linie(abstandOben = 4) {
    this.y -= abstandOben
    this.seite.drawLine({ start: { x: RAND, y: this.y }, end: { x: A4B - RAND, y: this.y }, thickness: 0.7, color: LINIE })
    this.y -= 10
  }
  ueberschrift(s: string) {
    this.platz(40)
    this.y -= 6
    this.text(s, RAND, 12, { fett: true })
    this.linie(5)
  }
  absatz(s: string, size = 10, x = RAND, breite = A4B - 2 * RAND, farbe: any = DUNKEL) {
    for (const z of this.t.umbruch(s, size, breite)) {
      this.platz(size + 4)
      if (z) this.seite.drawText(z, { x, y: this.y, size, font: this.t.font, color: farbe })
      this.y -= size + 3.5
    }
  }
}

function baueDeckblatt(doc: PDFDocument, t: Textmass, d: MappeDaten, eintraege: Eintrag[], versatz: number): { seiten: number; links: Link[] } {
  const w = new Schreiber(doc, t)
  const { auftrag, firma } = d
  const fz = auftrag.fahrzeug
  const kd = auftrag.kunde
  const rechtsX = A4B - RAND

  // Kopf
  w.text(firma.firma_name || 'Kfz-Werkstatt', RAND, 15, { fett: true })
  w.rechts('AUFTRAGSMAPPE', rechtsX, 19, { fett: true, farbe: ORANGE })
  w.y -= 14
  const adresse = [firma.firma_strasse, [firma.firma_plz, firma.firma_ort].filter(Boolean).join(' '), firma.firma_telefon ? 'Tel.: ' + firma.firma_telefon : '']
  const rechtsZeilen = [`Auftrag: ${auftrag.auftrag_nr ?? '—'}`, `Stand: ${datum(new Date().toISOString())}`, `Status: ${STATUS_LABEL[auftrag.status] ?? auftrag.status ?? '—'}`]
  for (let i = 0; i < Math.max(adresse.filter(Boolean).length, rechtsZeilen.length); i++) {
    const links = adresse.filter(Boolean)[i]
    if (links) w.text(links, RAND, 9, { farbe: GRAU })
    if (rechtsZeilen[i]) w.rechts(rechtsZeilen[i], rechtsX, 10, { fett: i === 0 })
    w.y -= 13
  }
  w.linie(2)

  // Kunde | Fahrzeug nebeneinander
  const kdZeilen = kd ? [
    `${kd.vorname ?? ''} ${kd.nachname ?? ''}`.trim(), kd.firma, kd.strasse, [kd.plz, kd.ort].filter(Boolean).join(' '),
    kd.telefon && `Tel.: ${kd.telefon}`, kd.mobil && `Mobil: ${kd.mobil}`, kd.email,
  ].filter(Boolean) as string[] : ['Kein Kunde zugewiesen']
  const fzZeilen = fz ? [
    `${fz.marke ?? ''} ${fz.modell ?? ''}`.trim(), fz.kennzeichen && `Kennzeichen: ${fz.kennzeichen}`, fz.baujahr && `Baujahr: ${fz.baujahr}`,
    fz.farbe && `Farbe: ${fz.farbe}`, fz.motortyp && `Motor: ${fz.motortyp}`,
    fz.kilometerstand != null && `KM-Stand: ${Number(fz.kilometerstand).toLocaleString('de-DE')} km`, fz.fahrgestellnummer && `FIN: ${fz.fahrgestellnummer}`,
  ].filter(Boolean) as string[] : ['—']
  const hoehe = 20 + Math.max(kdZeilen.length, fzZeilen.length) * 13
  w.platz(hoehe + 10)
  const spaltenX = RAND + 270
  w.text('Kunde', RAND, 11, { fett: true, farbe: ORANGE })
  w.text('Fahrzeug', spaltenX, 11, { fett: true, farbe: ORANGE })
  w.y -= 15
  const obenY = w.y
  kdZeilen.forEach((z, i) => { w.seite.drawText(t.kuerzen(z, 250, 10, i === 0), { x: RAND, y: obenY - i * 13, size: 10, font: i === 0 ? t.fett : t.font, color: DUNKEL }) })
  fzZeilen.forEach((z, i) => { w.seite.drawText(t.kuerzen(z, 250, 10, i === 0), { x: spaltenX, y: obenY - i * 13, size: 10, font: i === 0 ? t.fett : t.font, color: DUNKEL }) })
  w.y = obenY - Math.max(kdZeilen.length, fzZeilen.length) * 13 - 4

  // Annahme
  if (auftrag.annahme_datum) {
    w.ueberschrift('Annahmeprotokoll')
    const tank = auftrag.annahme_tank == null ? '—' : auftrag.annahme_tank === 0 ? 'Leer' : auftrag.annahme_tank === 100 ? 'Voll' : `${auftrag.annahme_tank} %`
    w.absatz(`Angenommen am ${datum(auftrag.annahme_datum)} · KM bei Annahme: ${auftrag.annahme_km != null ? Number(auftrag.annahme_km).toLocaleString('de-DE') + ' km' : '—'} · Tankstand: ${tank} · Zustand: ${ZUSTAND[auftrag.annahme_zustand] ?? '—'}`)
    if (auftrag.annahme_schaeden) w.absatz('Schäden / Anmerkungen: ' + auftrag.annahme_schaeden)
    if (auftrag.kostenrahmen_max) w.absatz('Vereinbarter Kostenrahmen: bis max. ' + euro(auftrag.kostenrahmen_max))
  }

  // Arbeiten
  w.ueberschrift('Vereinbarte Arbeiten')
  w.absatz(auftrag.arbeiten || '—')
  w.absatz(`Angenommen am ${datum(auftrag.erstellt_am)} · Geplante Fertigstellung: ${datum(auftrag.geplante_fertigstellung)}${auftrag.fertiggestellt_am ? ' · Fertiggestellt am ' + datum(auftrag.fertiggestellt_am) : ''}`, 9, RAND, A4B - 2 * RAND, GRAU)

  // Teile
  if (d.teile.length) {
    w.ueberschrift(`Ersatzteile & Bestellungen (${d.teile.length})`)
    d.teile.forEach((tt: any, i: number) => {
      w.platz(15)
      w.text(String(i + 1) + '.', RAND, 9, { farbe: GRAU })
      w.seite.drawText(t.kuerzen(`${tt.bezeichnung ?? ''}${tt.teilenummer ? '  #' + tt.teilenummer : ''}${tt.lieferant ? '  · ' + tt.lieferant : ''}`, 300, 9.5), { x: RAND + 18, y: w.y, size: 9.5, font: t.font, color: DUNKEL })
      w.rechts(`${tt.menge ?? 1}x ${tt.einzelpreis != null ? euro(tt.einzelpreis) : ''}`, RAND + 410, 9, { farbe: GRAU })
      w.rechts(TEIL_STATUS[tt.status] ?? tt.status ?? '', rechtsX, 9, { farbe: GRAU })
      w.y -= 13
    })
  }

  // Rechnungen
  if (d.rechnungen.length) {
    w.ueberschrift(`Rechnungen (${d.rechnungen.length})`)
    for (const r of d.rechnungen) {
      w.platz(15)
      w.text(`Nr. ${r.rechnungs_nr}`, RAND, 10, { fett: true })
      w.text(datum(r.erstellt_am), RAND + 150, 9.5, { farbe: GRAU })
      w.rechts(euro(r.betrag_brutto), RAND + 400, 10)
      w.rechts(RECHNUNG_STATUS[r.status] ?? r.status ?? '', rechtsX, 9.5, { fett: true, farbe: r.status === 'bezahlt' ? rgb(0.1, 0.5, 0.2) : r.status === 'storniert' ? GRAU : ORANGE })
      w.y -= 14
    }
  }

  // Inhaltsverzeichnis (anklickbar)
  w.ueberschrift('Inhalt dieser Mappe – zum Öffnen anklicken')
  if (!eintraege.length) {
    w.absatz('Zu diesem Auftrag sind keine weiteren Dateien hinterlegt.', 10, RAND, A4B - 2 * RAND, GRAU)
  }
  let letzteGruppe = ''
  for (const e of eintraege) {
    if (e.gruppe !== letzteGruppe) {
      w.platz(34)
      w.y -= 5
      w.text(e.gruppe.toUpperCase(), RAND, 8.5, { fett: true, farbe: GRAU })
      w.y -= 13
      letzteGruppe = e.gruppe
    }
    w.platz(16)
    const seitenNr = versatz + e.start + 1
    w.seite.drawText(t.kuerzen(e.titel, A4B - 2 * RAND - 90, 10), { x: RAND + 8, y: w.y, size: 10, font: t.font, color: BLAU })
    w.rechts(e.anzahl > 1 ? `Seite ${seitenNr}–${seitenNr + e.anzahl - 1}` : `Seite ${seitenNr}`, rechtsX, 9.5, { fett: true, farbe: BLAU })
    w.links.push({ seite: w.seitenIndex, rect: [RAND, w.y - 4, rechtsX, w.y + 11], ziel: versatz + e.start })
    w.y -= 15
  }
  if (eintraege.length) {
    w.y -= 6
    w.absatz('Tipp: Im PDF-Programm die Lesezeichen-Leiste öffnen (jede Datei ist dort einzeln aufgeführt). Die Original-Dateien der Dokumente und Belege sind zusätzlich als Dateianhänge (Büroklammer-Symbol) in dieses PDF eingebettet und lassen sich unverändert speichern oder einzeln öffnen.', 8.5, RAND, A4B - 2 * RAND, GRAU)
  }

  // Fußzeile
  const n = doc.getPageCount()
  for (let i = 0; i < n; i++) {
    const s = doc.getPage(i)
    const f = `Auftragsmappe ${t.sicher(auftrag.auftrag_nr ?? '')} · Deckblatt ${i + 1}/${n}`
    s.drawText(f, { x: A4B / 2 - t.breite(f, 8) / 2, y: 24, size: 8, font: t.font, color: GRAU })
  }
  return { seiten: n, links: w.links }
}

// ───────────────────────── Hilfen: Dateien ─────────────────────────
type Typ = 'pdf' | 'bild' | 'unbekannt'
function erkenneTyp(b: Uint8Array): Typ {
  if (b.length > 5 && String.fromCharCode(b[0], b[1], b[2], b[3], b[4]) === '%PDF-') return 'pdf'
  const jpeg = b[0] === 0xff && b[1] === 0xd8
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
  const gif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46
  const webp = String.fromCharCode(b[0], b[1], b[2], b[3]) === 'RIFF' && String.fromCharCode(b[8], b[9], b[10], b[11]) === 'WEBP'
  return jpeg || png || gif || webp ? 'bild' : 'unbekannt'
}

interface Jpeg { bytes: Buffer; b: number; h: number }
async function alsJpeg(buf: Uint8Array, maxKante: number, qualitaet: number): Promise<Jpeg> {
  const aus = await sharp(Buffer.from(buf), { failOn: 'none', limitInputPixels: 100_000_000 })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: maxKante, height: maxKante, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: qualitaet })
    .toBuffer({ resolveWithObject: true })
  return { bytes: aus.data, b: aus.info.width, h: aus.info.height }
}

async function mitLimit<T, R>(liste: T[], parallel: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const ergebnis: R[] = new Array(liste.length)
  let naechster = 0
  await Promise.all(Array.from({ length: Math.min(parallel, liste.length) }, async () => {
    while (true) {
      const i = naechster++
      if (i >= liste.length) return
      ergebnis[i] = await fn(liste[i], i)
    }
  }))
  return ergebnis
}

class Rumpf {
  doc!: PDFDocument
  font!: PDFFont
  fett!: PDFFont
  t!: Textmass
  eintraege: Eintrag[] = []
  anhaenge: Anhang[] = []
  hinweise: string[] = []
  dateien = 0
  fotos = 0
  constructor() {}
  async init() {
    this.doc = await PDFDocument.create()
    this.font = await this.doc.embedFont(StandardFonts.Helvetica)
    this.fett = await this.doc.embedFont(StandardFonts.HelveticaBold)
    this.t = new Textmass(this.font, this.fett)
  }
  get seiten() { return this.doc.getPageCount() }

  kopf(page: PDFPage, text: string) {
    page.drawText(this.t.kuerzen(text, page.getWidth() - 2 * 24, 8.5), { x: 24, y: page.getHeight() - 20, size: 8.5, font: this.font, color: GRAU })
  }

  /** Bild auf einer oder – bei sehr langen Screenshots – mehreren Seiten, nach Seitenverhältnis hoch/quer. */
  async bildSeiten(j: Jpeg, kopfText: string) {
    const quer = j.b > j.h * 1.15
    const sb = quer ? A4H : A4B
    const sh = quer ? A4B : A4H
    const innenB = sb - 48
    const innenH = sh - 24 - 34
    const maxVerhaeltnis = innenH / innenB
    let teile: Jpeg[] = [j]
    if (!quer && j.h / j.b > maxVerhaeltnis * 1.15) {
      const sliceH = Math.floor(j.b * maxVerhaeltnis)
      const anzahl = Math.min(12, Math.ceil(j.h / sliceH))
      teile = []
      for (let i = 0; i < anzahl; i++) {
        const top = i * sliceH
        const hoehe = Math.min(sliceH, j.h - top)
        if (hoehe < 8) break
        const bytes = await sharp(j.bytes).extract({ left: 0, top, width: j.b, height: hoehe }).jpeg({ quality: 85 }).toBuffer()
        teile.push({ bytes, b: j.b, h: hoehe })
      }
    }
    for (let i = 0; i < teile.length; i++) {
      const p = this.doc.addPage([sb, sh])
      this.kopf(p, teile.length > 1 ? `${kopfText}  (Teil ${i + 1} von ${teile.length})` : kopfText)
      const bild = await this.doc.embedJpg(teile[i].bytes)
      const faktor = Math.min(innenB / teile[i].b, innenH / teile[i].h)
      const bw = teile[i].b * faktor
      const bh = teile[i].h * faktor
      p.drawImage(bild, { x: (sb - bw) / 2, y: 24 + (innenH - bh), width: bw, height: bh })
    }
  }

  platzhalter(titel: string, grund: string) {
    const p = this.doc.addPage([A4B, A4H])
    p.drawText(this.t.kuerzen(titel, A4B - 2 * RAND, 14, true), { x: RAND, y: A4H - 90, size: 14, font: this.fett, color: DUNKEL })
    let y = A4H - 120
    for (const z of this.t.umbruch(grund, 11, A4B - 2 * RAND)) { p.drawText(z, { x: RAND, y, size: 11, font: this.font, color: GRAU }); y -= 16 }
  }

  /** Fremdes PDF Seite für Seite übernehmen. Gibt die Seitenzahl zurück oder wirft bei defekten/verschlüsselten Dateien. */
  async pdfAnhaengen(bytes: Uint8Array): Promise<number> {
    const quelle = await PDFDocument.load(bytes, { updateMetadata: false })
    const n = quelle.getPageCount()
    if (n === 0) throw new Error('PDF ohne Seiten')
    if (this.seiten + n > MAX_SEITEN) throw new Error('zu viele Seiten für eine Mappe')
    const seiten = await this.doc.copyPages(quelle, quelle.getPageIndices())
    seiten.forEach(s => this.doc.addPage(s))
    return n
  }
}

function dateiNameSicher(name: string, nr: number) {
  return `${String(nr).padStart(2, '0')}_${bereinigeDokumentName(name) || 'datei'}`
}

// ───────────────────────── Hauptfunktion ─────────────────────────
export async function baueKomplettMappe(supabase: SupabaseClient, betriebId: string, auftragId: string): Promise<MappeErgebnis | null> {
  const admin = createAdminClient()

  const { data: auftrag } = await supabase
    .from('auftraege')
    .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)')
    .eq('betrieb_id', betriebId).eq('id', auftragId).maybeSingle()
  if (!auftrag) return null

  const [{ data: fotosRows }, { data: rechnungsRows }, firma, { data: lsRows }, lieferRows, { data: dokRows }] = await Promise.all([
    supabase.from('auftrag_fotos').select('*').eq('auftrag_id', auftragId).order('erstellt_am'),
    supabase.from('kunden_rechnungen').select('*').eq('auftrag_id', auftragId).order('erstellt_am'),
    resolveFirmaSettings(supabase, betriebId),
    supabase.from('lieferschein_uploads').select('*').eq('auftrag_id', auftragId).order('erstellt_am'),
    auftrag.fahrzeug_id
      ? supabase.from('supplier_invoices').select('*').eq('fahrzeug_id', auftrag.fahrzeug_id).order('erstellt_am')
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('auftrag_dokumente').select('*').eq('auftrag_id', auftragId).order('erstellt_am'),
  ])
  const lieferantenRows = (lieferRows as any).data ?? []

  const r = new Rumpf()
  await r.init()
  const hinweis = (s: string) => r.hinweise.push(s)

  // ── Dateien vorab laden (begrenzt parallel, mit Größen-Budget) ──
  let eingang = 0
  const lade = async (bucket: string, pfad: string, erwartet?: number | null): Promise<Uint8Array | null> => {
    if (erwartet && erwartet > MAX_EINZELDATEI) return null
    if (eingang > MAX_GESAMT_EINGANG) return null
    const { data, error } = await admin.storage.from(bucket).download(pfad)
    if (error || !data) return null
    if (data.size > MAX_EINZELDATEI) return null
    eingang += data.size
    return new Uint8Array(await data.arrayBuffer())
  }

  const dokumente = (dokRows ?? []) as any[]
  const dokBytes = await mitLimit(dokumente, 4, d => lade(DOKUMENT_BUCKET, d.datei_pfad, d.groesse))

  const belege: { titel: string; typ: string; name: string; bucket: string; pfad: string }[] = []
  for (const l of (lsRows ?? []) as any[]) {
    const ort = speicherOrt(l.datei_url)
    if (!ort || !(BELEG_BUCKETS as readonly string[]).includes(ort.bucket)) continue
    belege.push({ titel: `${l.dokument_typ === 'rechnung' ? 'Rechnung' : 'Lieferschein'}: ${l.lieferant || l.dateiname || 'Dokument'}`, typ: 'Lieferanten-Beleg', name: l.dateiname || 'beleg', bucket: ort.bucket, pfad: ort.pfad })
  }
  for (const s of lieferantenRows as any[]) {
    const ort = speicherOrt(s.datei_url)
    if (!ort || !(BELEG_BUCKETS as readonly string[]).includes(ort.bucket)) continue
    belege.push({ titel: `Lieferantenrechnung: ${s.lieferant || s.rechnungsnummer || s.datei_name || 'Rechnung'}`, typ: 'Lieferanten-Beleg', name: s.datei_name || 'rechnung', bucket: ort.bucket, pfad: ort.pfad })
  }
  const belegBytes = await mitLimit(belege, 4, b => lade(b.bucket, b.pfad))

  const alleFotos = ((fotosRows ?? []) as any[]).filter(f => f.storage_path)
  if (alleFotos.length > MAX_FOTOS) hinweis(`Es sind ${alleFotos.length} Fotos vorhanden; in der Komplett-PDF sind die ersten ${MAX_FOTOS} enthalten.`)
  const fotos = alleFotos.slice(0, MAX_FOTOS)
  const fotoBilder = await mitLimit(fotos, 4, async f => {
    const bytes = await lade('auftrag-fotos', f.storage_path)
    if (!bytes) return null
    try { return await alsJpeg(bytes, 1300, 72) } catch { return null }
  })

  // ── 1) Rechnungen (jeweils als fertiges Rechnungs-PDF) ──
  const rechnungen = (rechnungsRows ?? []) as any[]
  for (const re of rechnungen) {
    const titel = `Rechnung ${re.rechnungs_nr}${re.status === 'storniert' ? ' (storniert)' : ''} – ${euro(re.betrag_brutto)}`
    const start = r.seiten
    try {
      const pdf = await rechnungPdfErzeugen(supabase, re.id, betriebId)
      if (!pdf) throw new Error('Rechnung nicht gefunden')
      await r.pdfAnhaengen(new Uint8Array(pdf.buffer))
      r.dateien++
    } catch (e: any) {
      console.error('[Mappe-PDF] Rechnung', re.id, e?.message)
      r.platzhalter(titel, 'Das Rechnungs-PDF konnte für diese Mappe nicht erzeugt werden. Bitte die Rechnung einzeln in der App öffnen.')
      hinweis(`Rechnung ${re.rechnungs_nr}: PDF konnte nicht erzeugt werden.`)
    }
    r.eintraege.push({ gruppe: 'Rechnungen', titel, start, anzahl: r.seiten - start })
  }

  // ── 2) Dokumente & Dateien (CarVertical usw.) ──
  for (let i = 0; i < dokumente.length; i++) {
    const d = dokumente[i]
    const kat = DOKUMENT_KATEGORIEN.find(k => k.value === d.kategorie)
    const titel = `${kat?.kurz ?? 'Datei'}: ${d.titel || d.datei_name}`
    const bytes = dokBytes[i]
    const start = r.seiten
    if (!bytes) {
      r.platzhalter(titel, 'Diese Datei konnte nicht geladen werden (zu groß oder nicht abrufbar). Sie ist in der App unter „Dokumente & Dateien“ zu finden.')
      hinweis(`„${d.titel || d.datei_name}“ konnte nicht eingefügt werden (zu groß oder nicht abrufbar).`)
    } else {
      await dateiEinfuegen(r, bytes, titel, `${kat?.label ?? 'Dokument'} · ${d.titel || d.datei_name}`, 'Dokumente & Dateien')
      r.dateien++
      r.anhaenge.push({ name: dateiNameSicher(d.datei_name || d.titel || 'dokument', r.anhaenge.length + 1), bytes, mime: d.datei_typ || 'application/octet-stream', beschreibung: titel })
    }
    r.eintraege.push({ gruppe: 'Dokumente & Dateien', titel, start, anzahl: r.seiten - start })
  }

  // ── 3) Lieferanten-Belege ──
  for (let i = 0; i < belege.length; i++) {
    const b = belege[i]
    const bytes = belegBytes[i]
    const start = r.seiten
    if (!bytes) {
      r.platzhalter(b.titel, 'Dieser Beleg konnte nicht geladen werden. Er ist in der App unter „Lieferanten-Belege“ zu finden.')
      hinweis(`Beleg „${b.titel}“ konnte nicht eingefügt werden.`)
    } else {
      await dateiEinfuegen(r, bytes, b.titel, `Lieferanten-Beleg · ${b.titel}`, 'Lieferanten-Belege')
      r.dateien++
      const typ = erkenneTyp(bytes)
      r.anhaenge.push({ name: dateiNameSicher(b.name, r.anhaenge.length + 1), bytes, mime: typ === 'pdf' ? 'application/pdf' : typ === 'bild' ? 'image/jpeg' : 'application/octet-stream', beschreibung: b.titel })
    }
    r.eintraege.push({ gruppe: 'Lieferanten-Belege', titel: b.titel, start, anzahl: r.seiten - start })
  }

  // ── 4) Fotodokumentation: 2 Fotos pro Seite, nach Kategorie ──
  const kategorien = ['annahme', 'reparatur', 'fertig', 'allgemein', 'fahrzeugschein', 'tuev']
  const fotosNachKat = new Map<string, { foto: any; bild: Jpeg | null }[]>()
  fotos.forEach((f, i) => {
    const k = kategorien.includes(f.kategorie) ? f.kategorie : 'allgemein'
    if (!fotosNachKat.has(k)) fotosNachKat.set(k, [])
    fotosNachKat.get(k)!.push({ foto: f, bild: fotoBilder[i] })
  })
  for (const k of kategorien) {
    const liste = fotosNachKat.get(k)
    if (!liste?.length) continue
    const start = r.seiten
    const brauchbar = liste.filter(x => x.bild)
    for (let i = 0; i < brauchbar.length; i += 2) {
      const p = r.doc.addPage([A4B, A4H])
      r.kopf(p, `Fotodokumentation · ${FOTO_KAT[k] ?? k} · Auftrag ${auftrag.auftrag_nr ?? ''}`)
      for (let s = 0; s < 2 && i + s < brauchbar.length; s++) {
        const { foto, bild } = brauchbar[i + s]
        const platzH = 345
        const obenY = A4H - 40 - s * (platzH + 50)
        const img = await r.doc.embedJpg(bild!.bytes)
        const faktor = Math.min((A4B - 2 * RAND) / bild!.b, platzH / bild!.h)
        const bw = bild!.b * faktor
        const bh = bild!.h * faktor
        p.drawImage(img, { x: (A4B - bw) / 2, y: obenY - bh, width: bw, height: bh })
        const unterschrift = `${datum(foto.erstellt_am)}${foto.beschreibung ? ' · ' + foto.beschreibung : ''}`
        p.drawText(r.t.kuerzen(unterschrift, A4B - 2 * RAND, 9), { x: RAND, y: obenY - platzH - 14, size: 9, font: r.font, color: GRAU })
      }
    }
    const fehlend = liste.length - brauchbar.length
    if (fehlend) hinweis(`${fehlend} Foto(s) der Kategorie „${FOTO_KAT[k] ?? k}“ konnten nicht eingefügt werden.`)
    r.fotos += brauchbar.length
    if (r.seiten > start) r.eintraege.push({ gruppe: 'Fotodokumentation', titel: `Fotos ${FOTO_KAT[k] ?? k} (${brauchbar.length})`, start, anzahl: r.seiten - start })
  }

  // ── Zusammensetzen: Deckblatt + Rumpf ──
  const daten: MappeDaten = { auftrag, firma, rechnungen, teile: (auftrag.ersatzteile ?? []) as any[] }
  // Probelauf, um die Seitenzahl des Deckblatts zu kennen (Inhaltsverzeichnis nennt absolute Seitenzahlen)
  const probe = await PDFDocument.create()
  const probeFont = new Textmass(await probe.embedFont(StandardFonts.Helvetica), await probe.embedFont(StandardFonts.HelveticaBold))
  const deckSeiten = baueDeckblatt(probe, probeFont, daten, r.eintraege, 0).seiten

  const fertig = await PDFDocument.create()
  const fFont = await fertig.embedFont(StandardFonts.Helvetica)
  const fFett = await fertig.embedFont(StandardFonts.HelveticaBold)
  const deck = baueDeckblatt(fertig, new Textmass(fFont, fFett), daten, r.eintraege, deckSeiten)
  const kopien = await fertig.copyPages(r.doc, r.doc.getPageIndices())
  kopien.forEach(s => fertig.addPage(s))

  // Klickbare Links auf dem Deckblatt
  const alleSeiten = fertig.getPages()
  for (const l of deck.links) {
    const ziel = alleSeiten[l.ziel]
    if (!ziel) continue
    const annot = fertig.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: l.rect, Border: [0, 0, 0], Dest: [ziel.ref, 'Fit'] })
    alleSeiten[l.seite].node.addAnnot(fertig.context.register(annot))
  }

  // Lesezeichen
  const gruppen: { name: string; kinder: { titel: string; seite: number }[] }[] = []
  for (const e of r.eintraege) {
    let g = gruppen.find(x => x.name === e.gruppe)
    if (!g) { g = { name: e.gruppe, kinder: [] }; gruppen.push(g) }
    g.kinder.push({ titel: e.titel, seite: deckSeiten + e.start })
  }
  setzeLesezeichen(fertig, [
    { titel: 'Deckblatt & Inhaltsverzeichnis', seite: 0 },
    ...gruppen.map(g => ({ titel: g.name, seite: g.kinder[0].seite, kinder: g.kinder })),
  ])

  // Originale als Dateianhänge (nur, solange die Datei nicht unnötig riesig wird)
  let angehaengt = 0
  const summeAnhang = r.anhaenge.reduce((s, a) => s + a.bytes.length, 0)
  if (summeAnhang <= MAX_ANHANG_GESAMT) {
    for (const a of r.anhaenge) {
      await fertig.attach(a.bytes, a.name, { mimeType: a.mime, description: a.beschreibung.slice(0, 200), creationDate: new Date(), modificationDate: new Date() })
      angehaengt++
    }
  } else if (r.anhaenge.length) {
    hinweis('Die Originaldateien sind zusammen zu groß, um sie zusätzlich einzubetten; ihre Inhalte sind als Seiten in der Mappe enthalten.')
  }

  fertig.setTitle(`Auftragsmappe ${auftrag.auftrag_nr ?? ''}`.trim())
  fertig.setAuthor(firma.firma_name || 'Kfz-Werkstatt')
  fertig.setSubject(`Auftrag ${auftrag.auftrag_nr ?? ''} – ${[auftrag.fahrzeug?.marke, auftrag.fahrzeug?.modell, auftrag.fahrzeug?.kennzeichen].filter(Boolean).join(' ')}`)
  fertig.setCreator('Werkstatt Manager')
  fertig.setProducer('Werkstatt Manager')
  fertig.setLanguage('de-DE')
  fertig.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))

  const bytes = await fertig.save({ useObjectStreams: true })
  return { bytes, seiten: fertig.getPageCount(), dateien: r.dateien, fotos: r.fotos, angehaengt, hinweise: r.hinweise, auftragNr: String(auftrag.auftrag_nr ?? '') }
}

async function dateiEinfuegen(r: Rumpf, bytes: Uint8Array, titel: string, kopfText: string, _gruppe: string) {
  const typ = erkenneTyp(bytes)
  const seitenVorher = r.seiten
  try {
    if (typ === 'pdf') {
      await r.pdfAnhaengen(bytes)
    } else if (typ === 'bild') {
      await r.bildSeiten(await alsJpeg(bytes, 2200, 85), kopfText)
    } else {
      throw new Error('Dateityp wird nicht unterstützt')
    }
  } catch (e: any) {
    // Halbfertige Seiten dieser Datei wieder entfernen, damit nur der Platzhalter bleibt
    console.error('[Mappe-PDF] Datei nicht einfügbar:', titel, e?.message)
    while (r.seiten > seitenVorher) r.doc.removePage(r.seiten - 1)
    r.platzhalter(titel, `Diese Datei konnte nicht als Seiten eingefügt werden (${typ === 'pdf' ? 'defektes oder passwortgeschütztes PDF' : 'nicht lesbar'}). Das Original ist als Dateianhang (Büroklammer-Symbol) in diesem PDF eingebettet.`)
    r.hinweise.push(`„${titel}“ konnte nicht als Seiten eingefügt werden; das Original ist als Anhang enthalten.`)
  }
}

// ───────────────────────── Lesezeichen (PDF-Gliederung) ─────────────────────────
interface Lesezeichen { titel: string; seite: number; kinder?: { titel: string; seite: number }[] }

function setzeLesezeichen(doc: PDFDocument, baum: Lesezeichen[]) {
  const ctx = doc.context
  const seiten = doc.getPages()
  const wurzelRef = ctx.nextRef()

  const knoten = (items: Lesezeichen[], elternRef: PDFRef): { erster: PDFRef; letzter: PDFRef; anzahl: number } => {
    const refs = items.map(() => ctx.nextRef())
    let anzahl = items.length
    items.forEach((it, i) => {
      const dict = ctx.obj({
        Title: PDFHexString.fromText(it.titel.slice(0, 250)),
        Parent: elternRef,
        Dest: [seiten[Math.min(it.seite, seiten.length - 1)].ref, 'Fit'],
      })
      if (i > 0) dict.set(PDFName.of('Prev'), refs[i - 1])
      if (i < items.length - 1) dict.set(PDFName.of('Next'), refs[i + 1])
      if (it.kinder?.length) {
        const k = knoten(it.kinder, refs[i])
        dict.set(PDFName.of('First'), k.erster)
        dict.set(PDFName.of('Last'), k.letzter)
        dict.set(PDFName.of('Count'), PDFNumber.of(k.anzahl))
        anzahl += k.anzahl
      }
      ctx.assign(refs[i], dict)
    })
    return { erster: refs[0], letzter: refs[refs.length - 1], anzahl }
  }

  const k = knoten(baum, wurzelRef)
  ctx.assign(wurzelRef, ctx.obj({ Type: 'Outlines', First: k.erster, Last: k.letzter, Count: k.anzahl }))
  doc.catalog.set(PDFName.of('Outlines'), wurzelRef)
}
