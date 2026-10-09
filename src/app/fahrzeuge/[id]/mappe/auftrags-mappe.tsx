'use client'
import { useState } from 'react'
import { fotoUrl, belegUrl } from '@/lib/datei-urls'
import Link from 'next/link'
import { ArrowLeft, Download, Car, User, Wrench, Package, Camera, FileText, Receipt, CheckCircle, Clock, AlertTriangle, Fuel, Gauge, Paperclip, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DOKUMENT_KATEGORIEN, formatGroesse } from '@/lib/auftrag-dokumente'

const STATUS_LABEL: Record<string, string> = {
  angenommen: 'Angenommen', diagnose: 'Diagnose', reparatur: 'In Arbeit',
  warten_teile: 'Warten auf Teile', fertig: 'Fertig', ausgeliefert: 'Ausgeliefert', storniert: 'Storniert',
}
const TEIL_STATUS_LABEL: Record<string, string> = {
  nicht_bestellt: 'Nicht bestellt', bestellt: 'Bestellt', unterwegs: 'Unterwegs', geliefert: 'Geliefert', eingebaut: 'Eingebaut',
}
const TEIL_STATUS_COLOR: Record<string, string> = {
  nicht_bestellt: 'bg-gray-100 text-gray-500', bestellt: 'bg-blue-100 text-blue-700',
  unterwegs: 'bg-yellow-100 text-yellow-700', geliefert: 'bg-green-100 text-green-700',
  eingebaut: 'bg-emerald-100 text-emerald-700',
}
const KAT_LABEL: Record<string, string> = {
  annahme: 'Annahme', reparatur: 'Reparatur', fertig: 'Fertig', allgemein: 'Allgemein',
  fahrzeugschein: 'Fahrzeugschein', tuev: 'TÜV-Bericht',
}
const ZUSTAND_LABEL: Record<string, string> = {
  sehr_gut: 'Sehr gut', gut: 'Gut', maessig: 'Mäßig', schlecht: 'Schlecht',
}

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function pdfCount(dokumente: any[]) {
  return dokumente.filter(d => !String(d.datei_typ).startsWith('image/')).length
}
function fmtEuro(n?: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €'
}

const DOKUMENT_TYP_LABEL: Record<string, string> = { lieferschein: '📦 Lieferschein', rechnung: '🧾 Rechnung' }

interface Props {
  auftrag: any
  fotos: any[]
  rechnungen: any[]
  firma: Record<string, string>
  betriebId: string
  dokumente?: any[]
  lieferantenRechnungen?: any[]
  auftragDokumente?: any[]
}

export function AuftragsMappe({ auftrag, fotos, rechnungen = [], firma, betriebId, dokumente = [], lieferantenRechnungen = [], auftragDokumente = [] }: Props) {
  const fz = auftrag.fahrzeug
  const kunde = auftrag.kunde
  const teile: any[] = auftrag.ersatzteile ?? []
  const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const [pdfLadendId, setPdfLadendId] = useState<string | null>(null)
  const [komplett, setKomplett] = useState<{ laedt: boolean; fehler?: string; ergebnis?: any }>({ laedt: false })

  // Komplett-PDF: Deckblatt + anklickbares Inhaltsverzeichnis + alle Dateien/Rechnungen/Fotos in EINEM PDF
  const komplettErstellen = async () => {
    setKomplett({ laedt: true })
    try {
      const res = await fetch('/api/mappe/komplett-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auftragId: auftrag.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Die Komplett-PDF konnte nicht erstellt werden.')
      setKomplett({ laedt: false, ergebnis: data })
    } catch (e: any) {
      setKomplett({ laedt: false, fehler: e?.message || 'Die Komplett-PDF konnte nicht erstellt werden.' })
    }
  }

  const rechnungPdfLaden = async (rechnungId: string, rechnungsNr: string) => {
    setPdfLadendId(rechnungId)
    try {
      const res = await fetch('/api/rechnung/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rechnungId, betriebId }),
      })
      if (!res.ok) throw new Error('PDF-Export fehlgeschlagen')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Rechnung_${rechnungsNr}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e) {
      alert('PDF-Export fehlgeschlagen')
    } finally {
      setPdfLadendId(null)
    }
  }

  const fotosByKat = (kat: string) => fotos.filter((f: any) => f.kategorie === kat)

  // Zwei unabhaengige Upload-Wege fuer Lieferanten-Belege (Lieferschein-Scanner
  // und das separate "Lieferanten-Rechnungen"-Widget) landen in verschiedenen
  // Tabellen -- hier zu einer einheitlichen Liste zusammengefuehrt, damit in
  // der Auftragsmappe kein Beleg fehlt, egal ueber welchen Weg er erfasst wurde.
  const alleBelege = [
    ...dokumente.map((d: any) => ({
      id: `ls-${d.id}`, url: belegUrl('lieferschein', d.id), titel: d.lieferant || d.dateiname || 'Dokument',
      typLabel: DOKUMENT_TYP_LABEL[d.dokument_typ] ?? DOKUMENT_TYP_LABEL.lieferschein,
      datum: d.lieferdatum || null,
    })),
    ...lieferantenRechnungen.map((r: any) => ({
      id: `si-${r.id}`, url: belegUrl('lieferant', r.id), titel: r.lieferant || r.rechnungsnummer || r.datei_name || 'Lieferantenrechnung',
      typLabel: '🧾 Rechnung',
      datum: r.rechnungsdatum || null,
    })),
  ]
  // Bilder aus dem Fahrzeug-Inserat (z. B. von mobile.de importiert)
  const fahrzeugBilder: string[] = (() => {
    try { const v = fz?.bilder_urls ? JSON.parse(fz.bilder_urls) : []; return Array.isArray(v) ? v.filter((u: any) => typeof u === 'string' && u) : [] } catch { return [] }
  })()
  const dokGruppen = DOKUMENT_KATEGORIEN
    .map(k => ({ ...k, items: auftragDokumente.filter((d: any) => d.kategorie === k.value) }))
    .filter(g => g.items.length > 0)
  const alleKats = ['annahme', 'reparatur', 'fertig', 'allgemein', 'fahrzeugschein', 'tuev'].filter(k => fotosByKat(k).length > 0)

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { background: white !important; font-size: 12px; }
          img { max-width: 100%; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>

      {/* Screen Header */}
      <div className="no-print bg-white border-b px-4 flex items-center gap-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: '12px' }}>
        <Link href={`/fahrzeuge/${auftrag.id}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Zurück</Button>
        </Link>
        <h1 className="font-semibold text-gray-900 flex-1">Auftragsmappe</h1>
        <Button size="sm" onClick={komplettErstellen} disabled={komplett.laedt} className="gap-2">
          {komplett.laedt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}Komplett-PDF (alle Dateien)
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-2">
          <Download className="w-4 h-4" />Seite drucken
        </Button>
      </div>

      {(komplett.laedt || komplett.fehler || komplett.ergebnis) && (
        <div className="no-print bg-sky-50 border-b border-sky-100 px-4 py-3 text-sm text-sky-900">
          {komplett.laedt && (
            <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Die Komplett-PDF wird erstellt (Rechnungen, Dokumente, Belege, Fotos) – das kann bis zu einer Minute dauern …</div>
          )}
          {komplett.fehler && <div className="text-red-700">{komplett.fehler}</div>}
          {komplett.ergebnis && (
            <div className="space-y-2">
              <div className="font-medium">
                Fertig: {komplett.ergebnis.seiten} Seiten · {komplett.ergebnis.dateien} Datei{komplett.ergebnis.dateien !== 1 ? 'en' : ''} · {komplett.ergebnis.fotos} Foto{komplett.ergebnis.fotos !== 1 ? 's' : ''} · {komplett.ergebnis.angehaengt} Original{komplett.ergebnis.angehaengt !== 1 ? 'e' : ''} als Anhang · {formatGroesse(komplett.ergebnis.groesse)}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={komplett.ergebnis.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-1.5 text-white text-sm font-medium hover:bg-sky-700">Öffnen</a>
                <a href={komplett.ergebnis.downloadUrl} className="inline-flex items-center gap-2 rounded-md border border-sky-300 bg-white px-3 py-1.5 text-sky-800 text-sm font-medium hover:bg-sky-100">Herunterladen</a>
              </div>
              <p className="text-xs text-sky-800/80">Im PDF: Deckblatt mit anklickbarem Inhaltsverzeichnis, Lesezeichen-Leiste (jede Datei einzeln) und die Originale als Anhänge (Büroklammer). Die Links sind 15 Minuten gültig – danach einfach erneut erstellen.</p>
              {komplett.ergebnis.hinweise?.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-amber-800">
                  {komplett.ergebnis.hinweise.map((h: string, i: number) => <li key={i}>{h}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content — shown on screen AND in print */}
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 bg-white min-h-screen">

        {/* ── Kopfzeile ── */}
        <div className="flex justify-between items-start pb-4 border-b-2 border-gray-900">
          <div>
            <div className="text-xl font-bold text-gray-900">{firma.firma_name || 'Kfz-Werkstatt'}</div>
            {firma.firma_strasse && <div className="text-sm text-gray-500">{firma.firma_strasse}</div>}
            {(firma.firma_plz || firma.firma_ort) && <div className="text-sm text-gray-500">{firma.firma_plz} {firma.firma_ort}</div>}
            {firma.firma_telefon && <div className="text-sm text-gray-500">Tel.: {firma.firma_telefon}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-600">AUFTRAGSMAPPE</div>
            <div className="text-sm text-gray-600 mt-1">Auftrag: <strong>{auftrag.auftrag_nr}</strong></div>
            <div className="text-sm text-gray-600">Stand: <strong>{heute}</strong></div>
            <div className="mt-1">
              <span className="inline-block bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {STATUS_LABEL[auftrag.status] ?? auftrag.status}
              </span>
            </div>
          </div>
        </div>

        {/* ── Kunden- & Fahrzeugdaten ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="border rounded-xl p-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3 pb-2 border-b">
              <User className="w-4 h-4 text-blue-500" />Kunde
            </h2>
            {kunde ? (
              <div className="text-sm space-y-0.5 text-gray-700">
                <div className="font-semibold text-base">{kunde.vorname} {kunde.nachname}</div>
                {kunde.firma && <div>{kunde.firma}</div>}
                {kunde.strasse && <div>{kunde.strasse}</div>}
                {(kunde.plz || kunde.ort) && <div>{kunde.plz} {kunde.ort}</div>}
                {kunde.telefon && <div>📞 {kunde.telefon}</div>}
                {kunde.mobil && <div>📱 {kunde.mobil}</div>}
                {kunde.email && <div>✉️ {kunde.email}</div>}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Kein Kunde zugewiesen</p>
            )}
          </section>

          <section className="border rounded-xl p-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3 pb-2 border-b">
              <Car className="w-4 h-4 text-orange-500" />Fahrzeug
            </h2>
            {fz ? (
              <div className="text-sm space-y-0.5 text-gray-700">
                <div className="font-semibold text-base">{fz.marke} {fz.modell}</div>
                {fz.kennzeichen && <div>Kennzeichen: <strong>{fz.kennzeichen}</strong></div>}
                {fz.baujahr && <div>Baujahr: {fz.baujahr}</div>}
                {fz.farbe && <div>Farbe: {fz.farbe}</div>}
                {fz.motortyp && <div>Motor: {fz.motortyp}</div>}
                {fz.kilometerstand && <div>KM-Stand: {fz.kilometerstand.toLocaleString('de-DE')} km</div>}
                {fz.fahrgestellnummer && <div className="text-xs text-gray-400">FIN: {fz.fahrgestellnummer}</div>}
              </div>
            ) : <p className="text-sm text-gray-400 italic">—</p>}
          </section>
        </div>

        {/* ── Annahmeprotokoll ── */}
        {auftrag.annahme_datum && (
          <section className="border rounded-xl p-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3 pb-2 border-b">
              <FileText className="w-4 h-4 text-purple-500" />Annahmeprotokoll
              <span className="text-xs font-normal text-gray-400 ml-auto">{fmt(auftrag.annahme_datum)}</span>
            </h2>
            <div className="grid grid-cols-3 gap-3 text-sm text-gray-700 mb-3">
              <div><span className="text-gray-400 block text-xs">KM bei Annahme</span>{auftrag.annahme_km ? auftrag.annahme_km.toLocaleString('de-DE') + ' km' : '—'}</div>
              <div><span className="text-gray-400 block text-xs">Tankstand</span>{auftrag.annahme_tank != null ? (auftrag.annahme_tank === 0 ? 'Leer' : auftrag.annahme_tank === 100 ? 'Voll' : `${auftrag.annahme_tank}%`) : '—'}</div>
              <div><span className="text-gray-400 block text-xs">Zustand</span>{ZUSTAND_LABEL[auftrag.annahme_zustand] ?? '—'}</div>
            </div>
            {auftrag.annahme_schaeden && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-700 mb-3">
                <span className="font-medium">Schäden / Anmerkungen: </span>{auftrag.annahme_schaeden}
              </div>
            )}
            {auftrag.kostenrahmen_max && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <span className="text-gray-500">Vereinbarter Kostenrahmen: </span>
                <strong>bis max. {fmtEuro(auftrag.kostenrahmen_max)}</strong>
              </div>
            )}
          </section>
        )}

        {/* ── Vereinbarte Arbeiten ── */}
        <section className="border rounded-xl p-4">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3 pb-2 border-b">
            <Wrench className="w-4 h-4 text-orange-500" />Vereinbarte Arbeiten
          </h2>
          <div className="text-sm text-gray-700 whitespace-pre-line">{auftrag.arbeiten || '—'}</div>
          <div className="grid grid-cols-2 gap-3 mt-3 text-sm text-gray-600">
            <div><span className="text-gray-400 block text-xs">Angenommen am</span>{fmt(auftrag.erstellt_am)}</div>
            <div><span className="text-gray-400 block text-xs">Geplante Fertigstellung</span>{fmt(auftrag.geplante_fertigstellung)}</div>
            {auftrag.fertiggestellt_am && <div><span className="text-gray-400 block text-xs">Fertiggestellt am</span>{fmt(auftrag.fertiggestellt_am)}</div>}
          </div>
        </section>

        {/* ── Ersatzteile ── */}
        {teile.length > 0 && (
          <section className="border rounded-xl p-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3 pb-2 border-b">
              <Package className="w-4 h-4 text-green-500" />Ersatzteile & Bestellungen
              <span className="text-xs font-normal text-gray-400 ml-auto">{teile.length} Position{teile.length !== 1 ? 'en' : ''}</span>
            </h2>
            <div className="space-y-2">
              {teile.map((t: any, i: number) => (
                <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex-1">
                    <span className="text-gray-400 text-xs mr-1">{i + 1}.</span>
                    <span className="font-medium text-gray-800">{t.bezeichnung}</span>
                    {t.teilenummer && <span className="text-xs text-gray-400 ml-2">#{t.teilenummer}</span>}
                    {t.lieferant && <span className="text-xs text-gray-400 ml-2">· {t.lieferant}</span>}
                    <div className="text-xs text-gray-500">{t.menge}× {t.einzelpreis != null ? fmtEuro(t.einzelpreis) : ''}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${TEIL_STATUS_COLOR[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {TEIL_STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Dokumente & Dateien (CarVertical, Gutachten, Fahrzeugbrief, ... als PDF oder Bild) ── */}
        {auftragDokumente.length > 0 && (
          <section className="border rounded-xl p-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3 pb-2 border-b">
              <FileText className="w-4 h-4 text-sky-500" />Dokumente & Dateien
              <span className="text-xs font-normal text-gray-400 ml-auto">{auftragDokumente.length} Datei{auftragDokumente.length !== 1 ? 'en' : ''}</span>
            </h2>
            {dokGruppen.map(g => {
              const bilder = g.items.filter((d: any) => String(d.datei_typ).startsWith('image/'))
              const pdfs = g.items.filter((d: any) => !String(d.datei_typ).startsWith('image/'))
              return (
                <div key={g.value} className="mb-4 last:mb-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{g.label}</p>
                  {pdfs.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {pdfs.map((d: any) => (
                        <a key={d.id} href={`/api/auftrag-dokument/datei?id=${d.id}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <span className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <span className="font-medium text-gray-800 truncate">{d.titel || d.datei_name}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0">PDF · {fmt(d.erstellt_am)}{d.groesse ? ` · ${formatGroesse(d.groesse)}` : ''}</span>
                          </span>
                          <span className="no-print text-xs text-blue-600 flex-shrink-0">Öffnen →</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {bilder.length > 0 && (
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                      {bilder.map((d: any) => (
                        <a key={d.id} href={`/api/auftrag-dokument/datei?id=${d.id}`} target="_blank" rel="noopener noreferrer" className="block">
                          <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                            <img src={`/api/auftrag-dokument/datei?id=${d.id}`} alt={d.titel ?? d.datei_name} className="w-full h-full object-cover" />
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 truncate">{d.titel || d.datei_name}</p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {pdfCount(auftragDokumente) > 0 && (
              <p className="no-print text-xs text-gray-400 mt-2">Beim Drucken dieser Seite werden PDF-Dateien nur aufgelistet. Für alle Dateien in einem PDF (mit anklickbarem Inhaltsverzeichnis): oben „Komplett-PDF (alle Dateien)“.</p>
            )}
          </section>
        )}

        {/* ── Lieferanten-Belege (Lieferscheine & Rechnungen von Lieferanten, aus beiden Upload-Wegen) ── */}
        {alleBelege.length > 0 && (
          <section className="border rounded-xl p-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3 pb-2 border-b">
              <Paperclip className="w-4 h-4 text-blue-500" />Lieferanten-Belege
              <span className="text-xs font-normal text-gray-400 ml-auto">{alleBelege.length} Dokument{alleBelege.length !== 1 ? 'e' : ''}</span>
            </h2>
            <div className="space-y-2">
              {alleBelege.map(b => (
                <a key={b.id} href={b.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <div className="flex-1">
                    <span className="font-medium text-gray-800">{b.titel}</span>
                    <span className="text-xs text-gray-400 ml-2">{b.typLabel}</span>
                    {b.datum && <div className="text-xs text-gray-500">{b.datum}</div>}
                  </div>
                  <span className="text-xs text-blue-600 flex-shrink-0">Ansehen →</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Rechnungen (alle Rechnungen dieses Auftrags, mit allen Positionen) ── */}
        {rechnungen.length > 0 && (
          <section className="border rounded-xl p-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3 pb-2 border-b">
              <Receipt className="w-4 h-4 text-emerald-500" />Rechnungen
              <span className="text-xs font-normal text-gray-400 ml-auto">{rechnungen.length} Rechnung{rechnungen.length !== 1 ? 'en' : ''}</span>
            </h2>
            <div className="space-y-5">
              {rechnungen.map((r: any) => {
                const alleZeilen = [
                  ...r.ersatzteilePositionen.map((p: any) => ({ ...p, gruppe: 'Ersatzteile' })),
                  ...(r.betriebsstoffePositionen ?? []).map((p: any) => ({
                    ...p,
                    beschreibung: p.bezeichnung,
                    mengeText: `${p.menge.toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${p.einheit}`,
                    gruppe: 'Betriebsstoffe',
                  })),
                  ...r.arbeitswertePositionen.map((p: any) => ({ ...p, gruppe: 'Arbeitszeit' })),
                  ...(r.kleinteilNetto > 0 ? [{ beschreibung: 'Kleinteilpauschale', menge: 1, preis: r.kleinteilNetto, summe: r.kleinteilNetto, gruppe: 'Sonstiges' }] : []),
                  ...(r.sonstigesNetto > 0 ? [{ beschreibung: r.sonstigesBeschreibung || 'Sonstige Leistungen', menge: 1, preis: r.sonstigesNetto, summe: r.sonstigesNetto, gruppe: 'Sonstiges' }] : []),
                ]
                return (
                  <div key={r.id} className={`border rounded-lg p-3 ${r.status === 'storniert' ? 'opacity-60 bg-gray-50' : ''}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="text-sm">
                        <strong>{r.rechnungs_nr}</strong>
                        <span className="text-gray-400 ml-2">{fmt(r.erstellt_am)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.status === 'storniert' ? 'bg-gray-200 text-gray-500' : r.status === 'bezahlt' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {r.status === 'storniert' ? 'Storniert' : r.status === 'bezahlt' ? 'Bezahlt' : 'Offen'}
                        </span>
                        <button
                          onClick={() => rechnungPdfLaden(r.id, r.rechnungs_nr)}
                          disabled={pdfLadendId === r.id}
                          className="no-print text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {pdfLadendId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          PDF
                        </button>
                      </div>
                    </div>

                    {alleZeilen.length > 0 && (
                      <table className="w-full text-xs mb-2">
                        <tbody>
                          {alleZeilen.map((p: any, i: number) => (
                            <tr key={i} className="border-b border-gray-50 last:border-0">
                              <td className="py-1 text-gray-400 w-20 align-top">{p.gruppe}</td>
                              <td className="py-1 text-gray-700">{p.beschreibung}</td>
                              <td className="py-1 text-gray-500 text-right w-16">{p.mengeText ?? `${p.menge}×`}</td>
                              <td className="py-1 text-gray-700 text-right w-20">{fmtEuro(p.summe)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm pt-2 border-t">
                      <div><span className="text-gray-400 block text-xs">Netto</span>{fmtEuro(r.betrag_netto)}</div>
                      <div><span className="text-gray-400 block text-xs">MwSt.</span>{fmtEuro(r.betrag_mwst)}</div>
                      <div><span className="text-gray-400 block text-xs">Brutto</span><strong>{fmtEuro(r.betrag_brutto)}</strong></div>
                      <div><span className="text-gray-400 block text-xs">Fällig am</span>{fmt(r.faellig_am)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Fotos ── */}
        {fotos.length > 0 && (
          <section className="border rounded-xl p-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-4 pb-2 border-b">
              <Camera className="w-4 h-4 text-purple-500" />Fotodokumentation
              <span className="text-xs font-normal text-gray-400 ml-auto">{fotos.length} Foto{fotos.length !== 1 ? 's' : ''}</span>
            </h2>
            {alleKats.map(kat => (
              <div key={kat} className="mb-4 last:mb-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{KAT_LABEL[kat]}</p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {fotosByKat(kat).map((foto: any) => (
                    <div key={foto.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img src={fotoUrl(foto.id)} alt={foto.beschreibung ?? ''} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── Fahrzeugbilder (aus dem Inserat) ── */}
        {fahrzeugBilder.length > 0 && (
          <section className="border rounded-xl p-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-4 pb-2 border-b">
              <Car className="w-4 h-4 text-orange-500" />Fahrzeugbilder
              <span className="text-xs font-normal text-gray-400 ml-auto">{fahrzeugBilder.length} Bild{fahrzeugBilder.length !== 1 ? 'er' : ''}</span>
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {fahrzeugBilder.map((url, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Notizen ── */}
        {auftrag.notizen && (
          <section className="border rounded-xl p-4">
            <h2 className="font-semibold text-gray-800 mb-2 pb-2 border-b">Notizen</h2>
            <p className="text-sm text-gray-700 whitespace-pre-line">{auftrag.notizen}</p>
          </section>
        )}

        {/* ── Druckfuss ── */}
        <div className="print-only text-xs text-gray-400 border-t pt-3 mt-8">
          Erstellt: {heute} · {firma.firma_name} {firma.firma_strasse && `· ${firma.firma_strasse}`} {firma.firma_ort && `· ${firma.firma_plz} ${firma.firma_ort}`}
        </div>
      </div>
    </>
  )
}
