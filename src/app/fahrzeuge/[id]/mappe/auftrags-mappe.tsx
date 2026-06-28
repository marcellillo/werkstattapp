'use client'
import Link from 'next/link'
import { ArrowLeft, Download, Car, User, Wrench, Package, Camera, FileText, Receipt, CheckCircle, Clock, AlertTriangle, Fuel, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
}
const ZUSTAND_LABEL: Record<string, string> = {
  sehr_gut: 'Sehr gut', gut: 'Gut', maessig: 'Mäßig', schlecht: 'Schlecht',
}

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtEuro(n?: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €'
}

interface Props {
  auftrag: any
  fotos: any[]
  rechnung: any
  firma: Record<string, string>
}

export function AuftragsMappe({ auftrag, fotos, rechnung, firma }: Props) {
  const fz = auftrag.fahrzeug
  const kunde = auftrag.kunde
  const teile: any[] = auftrag.ersatzteile ?? []
  const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const fotosByKat = (kat: string) => fotos.filter((f: any) => f.kategorie === kat)
  const alleKats = ['annahme', 'reparatur', 'fertig', 'allgemein'].filter(k => fotosByKat(k).length > 0)

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
        <Button size="sm" onClick={() => window.print()} className="gap-2">
          <Download className="w-4 h-4" />Als PDF speichern
        </Button>
      </div>

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

        {/* ── Rechnung ── */}
        {rechnung && (
          <section className="border rounded-xl p-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3 pb-2 border-b">
              <Receipt className="w-4 h-4 text-emerald-500" />Rechnung
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-400 block text-xs">Rechnungsnr.</span><strong>{rechnung.rechnungs_nr}</strong></div>
              <div><span className="text-gray-400 block text-xs">Betrag (brutto)</span><strong>{fmtEuro(rechnung.betrag_brutto)}</strong></div>
              <div><span className="text-gray-400 block text-xs">Status</span>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${rechnung.status === 'bezahlt' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {rechnung.status === 'bezahlt' ? 'Bezahlt' : 'Offen'}
                </span>
              </div>
              <div><span className="text-gray-400 block text-xs">Fällig am</span>{fmt(rechnung.faellig_am)}</div>
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
                      <img src={foto.url} alt={foto.beschreibung ?? ''} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
