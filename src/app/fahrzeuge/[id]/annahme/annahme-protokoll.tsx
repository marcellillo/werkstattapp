'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Printer, Save, Car, User, Wrench, Euro, Fuel, Gauge, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

type Firma = Record<string, string>

interface Props {
  auftrag: any
  firma: Firma
}

const ZUSTAND_LABEL: Record<string, string> = {
  sehr_gut: 'Sehr gut',
  gut: 'Gut',
  maessig: 'Mäßig',
  schlecht: 'Schlecht',
}

export function AnnahmeProtokoll({ auftrag: initialAuftrag, firma }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [auftrag, setAuftrag] = useState(initialAuftrag)
  const [annahmeKm, setAnnahmeKm] = useState(String(initialAuftrag.annahme_km ?? initialAuftrag.fahrzeug?.kilometerstand ?? ''))
  const [annahmeTank, setAnnahmeTank] = useState(String(initialAuftrag.annahme_tank ?? 50))
  const [annahmeSchaeden, setAnnahmeSchaeden] = useState(initialAuftrag.annahme_schaeden ?? '')
  const [annahmeZustand, setAnnahmeZustand] = useState(initialAuftrag.annahme_zustand ?? 'gut')
  const [kostenrahmen, setKostenrahmen] = useState(String(initialAuftrag.kostenrahmen_max ?? ''))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [drucken, setDrucken] = useState(false)

  const fahrzeug = auftrag.fahrzeug
  const kunde = auftrag.kunde
  const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  async function speichern(undDrucken = false) {
    setSaving(true)
    await supabase.from('auftraege').update({
      annahme_km: annahmeKm ? parseInt(annahmeKm) : null,
      annahme_tank: annahmeTank ? parseInt(annahmeTank) : null,
      annahme_schaeden: annahmeSchaeden || null,
      annahme_zustand: annahmeZustand,
      kostenrahmen_max: kostenrahmen ? parseFloat(kostenrahmen.replace(',', '.')) : null,
      annahme_datum: new Date().toISOString(),
    }).eq('id', auftrag.id)
    setSaving(false)
    setSaved(true)
    if (undDrucken) window.print()
  }

  const tankStufen = [0, 25, 50, 75, 100]

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="no-print bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="bg-white border-b px-4 pt-safe pb-3 pt-3 flex items-center gap-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <Link href={`/fahrzeuge/${auftrag.id}`}>
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Zurück</Button>
          </Link>
          <h1 className="font-semibold text-gray-900">Annahmeprotokoll</h1>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => speichern(false)} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />{saving ? 'Speichern…' : saved ? 'Gespeichert ✓' : 'Speichern'}
            </Button>
            <Button size="sm" onClick={() => speichern(true)} disabled={saving}>
              <Printer className="w-4 h-4 mr-1" />Speichern & Drucken
            </Button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-4 space-y-4">
          {/* Fahrzeugzustand */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="w-5 h-5 text-orange-500" />
                Fahrzeugzustand bei Annahme
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Kilometerstand</label>
                  <input
                    type="number"
                    value={annahmeKm}
                    onChange={e => setAnnahmeKm(e.target.value)}
                    placeholder="z.B. 85000"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Allgemeiner Zustand</label>
                  <div className="flex gap-1">
                    {Object.entries(ZUSTAND_LABEL).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAnnahmeZustand(val)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          annahmeZustand === val
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'border-gray-200 text-gray-600 hover:border-orange-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tankstand */}
              <div>
                <label className="text-xs text-gray-600 mb-2 block flex items-center gap-1">
                  <Fuel className="w-3.5 h-3.5" /> Tankstand
                </label>
                <div className="flex gap-2 items-center">
                  {tankStufen.map(stufe => (
                    <button
                      key={stufe}
                      type="button"
                      onClick={() => setAnnahmeTank(String(stufe))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        parseInt(annahmeTank) === stufe
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 text-gray-600 hover:border-blue-300'
                      }`}
                    >
                      {stufe === 0 ? 'Leer' : stufe === 100 ? 'Voll' : `${stufe}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vorhandene Schäden */}
              <div>
                <label className="text-xs text-gray-600 mb-1 block flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" /> Vorhandene Schäden / Anmerkungen
                </label>
                <textarea
                  value={annahmeSchaeden}
                  onChange={e => setAnnahmeSchaeden(e.target.value)}
                  placeholder="z.B. Kratzer hinten links, Delle Stoßstange vorne, Innenraumgeruch..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </CardContent>
          </Card>

          {/* Kostenrahmen */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Euro className="w-5 h-5 text-green-600" />
                Kostenvoranschlag
              </CardTitle>
            </CardHeader>
            <CardContent>
              <label className="text-xs text-gray-600 mb-1 block">Maximaler Kostenrahmen (€ brutto)</label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">bis max.</span>
                <input
                  type="text"
                  value={kostenrahmen}
                  onChange={e => setKostenrahmen(e.target.value)}
                  placeholder="z.B. 450,00"
                  className="w-40 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <span className="text-sm text-gray-500">€</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Bei Mehrkosten wird der Kunde kontaktiert (§ 632a BGB)</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== DRUCKANSICHT ===== */}
      <div className="print-page hidden print:block bg-white p-10 max-w-[210mm] mx-auto text-sm font-sans">
        {/* Kopfzeile */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-900">
          <div>
            <div className="text-xl font-bold text-gray-900">{firma.firma_name || 'Kfz-Werkstatt'}</div>
            {firma.firma_strasse && <div className="text-gray-600">{firma.firma_strasse}</div>}
            {(firma.firma_plz || firma.firma_ort) && <div className="text-gray-600">{firma.firma_plz} {firma.firma_ort}</div>}
            {firma.firma_telefon && <div className="text-gray-600">Tel.: {firma.firma_telefon}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-600 mb-1">ANNAHMEPROTOKOLL</div>
            <div className="text-gray-600">Auftrag: <strong>{auftrag.auftrag_nr}</strong></div>
            <div className="text-gray-600">Datum: <strong>{heute}</strong></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Kundendaten */}
          <div>
            <div className="font-bold text-gray-800 mb-2 pb-1 border-b border-gray-300">Kunde</div>
            {kunde ? (
              <div className="space-y-0.5 text-gray-700">
                <div className="font-semibold">{kunde.vorname} {kunde.nachname}</div>
                {kunde.firma && <div>{kunde.firma}</div>}
                {kunde.strasse && <div>{kunde.strasse}</div>}
                {(kunde.plz || kunde.ort) && <div>{kunde.plz} {kunde.ort}</div>}
                {kunde.telefon && <div>Tel.: {kunde.telefon}</div>}
                {kunde.mobil && <div>Mobil: {kunde.mobil}</div>}
                {kunde.email && <div>{kunde.email}</div>}
              </div>
            ) : (
              <div className="text-gray-400">Kein Kunde zugewiesen</div>
            )}
          </div>

          {/* Fahrzeugdaten */}
          <div>
            <div className="font-bold text-gray-800 mb-2 pb-1 border-b border-gray-300">Fahrzeug</div>
            {fahrzeug && (
              <div className="space-y-0.5 text-gray-700">
                <div className="font-semibold">{fahrzeug.marke} {fahrzeug.modell}</div>
                {fahrzeug.kennzeichen && <div>Kennzeichen: <strong>{fahrzeug.kennzeichen}</strong></div>}
                {fahrzeug.baujahr && <div>Baujahr: {fahrzeug.baujahr}</div>}
                {fahrzeug.farbe && <div>Farbe: {fahrzeug.farbe}</div>}
                {fahrzeug.fahrgestellnummer && <div className="text-xs text-gray-500">FIN: {fahrzeug.fahrgestellnummer}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Fahrzeugzustand */}
        <div className="mb-5">
          <div className="font-bold text-gray-800 mb-2 pb-1 border-b border-gray-300">Fahrzeugzustand bei Annahme</div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-gray-500">Kilometerstand:</span>
              <span className="ml-2 font-semibold">{annahmeKm ? parseInt(annahmeKm).toLocaleString('de-DE') + ' km' : '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Tankstand:</span>
              <span className="ml-2 font-semibold">{parseInt(annahmeTank) === 0 ? 'Leer' : parseInt(annahmeTank) === 100 ? 'Voll' : `ca. ${annahmeTank}%`}</span>
            </div>
            <div>
              <span className="text-gray-500">Zustand:</span>
              <span className="ml-2 font-semibold">{ZUSTAND_LABEL[annahmeZustand] ?? annahmeZustand}</span>
            </div>
          </div>
          {annahmeSchaeden && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-gray-700">
              <span className="font-semibold">Vorhandene Schäden / Anmerkungen: </span>{annahmeSchaeden}
            </div>
          )}
        </div>

        {/* Vereinbarte Arbeiten */}
        <div className="mb-5">
          <div className="font-bold text-gray-800 mb-2 pb-1 border-b border-gray-300">Vereinbarte Arbeiten</div>
          <div className="whitespace-pre-line text-gray-700 min-h-[60px]">{auftrag.arbeiten || '—'}</div>
        </div>

        {/* Kostenrahmen */}
        <div className="mb-5 p-3 border-2 border-gray-800 rounded">
          <div className="font-bold text-gray-800 mb-1">Kostenvoranschlag (§ 632a BGB)</div>
          <div className="text-gray-700">
            Die Reparaturkosten werden voraussichtlich <strong>bis max.{' '}
            {kostenrahmen
              ? parseFloat(kostenrahmen.replace(',', '.')).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €'
              : '___________'} (brutto)</strong> betragen.
            Bei absehbaren Mehrkosten wird der Auftraggeber vorab kontaktiert und um Zustimmung gebeten.
          </div>
          {auftrag.geplante_fertigstellung && (
            <div className="text-gray-700 mt-1">
              Voraussichtliche Fertigstellung:{' '}
              <strong>{new Date(auftrag.geplante_fertigstellung + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</strong>
            </div>
          )}
        </div>

        {/* Unterschriften */}
        <div className="grid grid-cols-2 gap-8 mt-10">
          <div>
            <div className="border-t border-gray-400 pt-2 text-gray-500 text-xs">
              Ort, Datum / Unterschrift Auftraggeber
            </div>
          </div>
          <div>
            <div className="border-t border-gray-400 pt-2 text-gray-500 text-xs">
              Ort, Datum / Unterschrift Werkstatt
            </div>
          </div>
        </div>

        <div className="mt-8 text-xs text-gray-400 border-t pt-3">
          Mit Ihrer Unterschrift bestätigen Sie die Richtigkeit der Fahrzeugdaten und beauftragen die oben genannten Arbeiten
          zum angegebenen Kostenrahmen. Es gelten die allgemeinen Geschäftsbedingungen des Kraftfahrzeuggewerbes (AGB KFG).
        </div>
      </div>
    </>
  )
}
