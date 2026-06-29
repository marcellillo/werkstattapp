'use client'
import { useState } from 'react'
import { Calculator, ChevronRight, Receipt, Wrench, Package, Info, Settings, Percent } from 'lucide-react'
import { RechnungDruck } from './rechnung-druck'
import { cn } from '@/lib/utils'

interface Props {
  auftrag: any
  firma: Record<string, string>
}

export function RechnungFlow({ auftrag, firma }: Props) {
  const teile = (auftrag.ersatzteile ?? []) as any[]
  const stundensatzDefault = parseFloat(firma.firma_stundensatz ?? '0') || 95
  const kleinunternehmer = firma.firma_kleinunternehmer === 'ja'

  // Teile-Summe automatisch berechnen (netto)
  const teileNettoAuto = teile.reduce((s: number, t: any) => {
    const ep = kleinunternehmer ? (t.einzelpreis ?? 0) : (t.einzelpreis ?? 0) / 1.19
    return s + ep * (t.menge ?? 1)
  }, 0)

  const [stunden, setStunden] = useState('')
  const [arbeitPreisManual, setArbeitPreisManual] = useState('')
  const [eingabeModus, setEingabeModus] = useState<'stunden' | 'preis'>('stunden')
  const [stundensatzEdit, setStundensatzEdit] = useState(String(stundensatzDefault))
  const [sonstiges, setSonstiges] = useState('')
  const [kleinteilAktiv, setKleinteilAktiv] = useState(false)
  const [kleinteilModus, setKleinteilModus] = useState<'prozent' | 'fest'>('fest')
  const [kleinteilProzent, setKleinteilProzent] = useState('10')
  const [kleinteilFest, setKleinteilFest] = useState('11')
  const [schritt, setSchritt] = useState<'vorbereiten' | 'drucken'>('vorbereiten')
  const [finalAuftrag, setFinalAuftrag] = useState(auftrag)

  const stundensatzZahl = parseFloat(stundensatzEdit) || stundensatzDefault
  const stundenZahl = parseFloat(stunden) || 0
  const arbeitNetto = eingabeModus === 'stunden'
    ? stundenZahl * stundensatzZahl
    : parseFloat(arbeitPreisManual) || 0
  const sonstigesNetto = parseFloat(sonstiges) || 0
  const kleinteilNetto = kleinteilAktiv
    ? (kleinteilModus === 'prozent'
        ? teileNettoAuto * (parseFloat(kleinteilProzent) || 0) / 100
        : parseFloat(kleinteilFest) || 0)
    : 0

  const gesamtNetto = teileNettoAuto + arbeitNetto + sonstigesNetto + kleinteilNetto
  const mwst = kleinunternehmer ? 0 : gesamtNetto * 0.19
  const gesamtBrutto = gesamtNetto + mwst

  function weiterZumDruck() {
    setFinalAuftrag({
      ...auftrag,
      einnahmen: gesamtBrutto,
      _arbeit_netto: arbeitNetto,
      _arbeit_stunden: eingabeModus === 'stunden' ? stundenZahl : null,
      _sonstiges_netto: sonstigesNetto,
      _kleinteil_netto: kleinteilNetto,
      _stundensatz: stundensatzZahl,
    })
    setSchritt('drucken')
  }

  if (schritt === 'drucken') {
    return <RechnungDruck auftrag={finalAuftrag} firma={firma} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sticky top-0 z-10 topbar-safe">
        <div className="max-w-lg mx-auto flex items-center justify-between py-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-600" /> Rechnung erstellen
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {(auftrag.fahrzeug?.marke ?? '')} {(auftrag.fahrzeug?.modell ?? '')} · Auftrag {auftrag.auftrag_nr}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Ersatzteile — automatisch */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
            <Package className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold text-gray-700">Ersatzteile & Material</span>
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Automatisch</span>
          </div>
          {teile.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-400 italic">Keine Ersatzteile eingetragen</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {teile.map((t: any) => {
                const ep = kleinunternehmer ? (t.einzelpreis ?? 0) : (t.einzelpreis ?? 0) / 1.19
                const gp = ep * (t.menge ?? 1)
                return (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <span className="text-gray-800">{t.bezeichnung}</span>
                      <span className="text-gray-400 text-xs ml-1">× {t.menge}</span>
                    </div>
                    <span className="font-medium text-gray-700 tabular-nums">
                      {gp.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                )
              })}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm font-semibold">
                <span className="text-gray-600">Teile gesamt (netto)</span>
                <span className="text-gray-900 tabular-nums">
                  {teileNettoAuto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Arbeitsleistung */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
            <Wrench className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-700">Arbeitsleistung</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Modus-Umschalter */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setEingabeModus('stunden')}
                className={cn(
                  'flex-1 py-2 text-xs font-semibold rounded-md transition-all',
                  eingabeModus === 'stunden' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                )}
              >
                Stunden eingeben
              </button>
              <button
                onClick={() => setEingabeModus('preis')}
                className={cn(
                  'flex-1 py-2 text-xs font-semibold rounded-md transition-all',
                  eingabeModus === 'preis' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                )}
              >
                Preis direkt
              </button>
            </div>

            {eingabeModus === 'stunden' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Arbeitsstunden</label>
                    <input
                      type="number"
                      value={stunden}
                      onChange={e => setStunden(e.target.value)}
                      placeholder="z.B. 2.5"
                      min="0"
                      step="0.5"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-center text-xl font-bold"
                    />
                  </div>
                  <div className="text-gray-400 text-lg font-bold mt-5">×</div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                      Stundensatz
                      <Settings className="w-3 h-3 text-gray-400" />
                    </label>
                    <input
                      type="number"
                      value={stundensatzEdit}
                      onChange={e => setStundensatzEdit(e.target.value)}
                      min="0"
                      step="1"
                      className="w-full px-4 py-3 border border-blue-200 rounded-xl text-sm bg-blue-50 text-center text-xl font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div className="text-gray-400 text-lg font-bold mt-5">=</div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Arbeit netto</label>
                    <div className={cn(
                      'w-full px-4 py-3 border rounded-xl text-sm text-center text-xl font-bold',
                      arbeitNetto > 0 ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-100 bg-gray-50 text-gray-300'
                    )}>
                      {arbeitNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 bg-blue-50 rounded-lg px-3 py-2">
                  <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  Stundensatz hier direkt änderbar (Standard aus Einstellungen: {stundensatzDefault} €)
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Arbeitsleistung netto (€)</label>
                <input
                  type="number"
                  value={arbeitPreisManual}
                  onChange={e => setArbeitPreisManual(e.target.value)}
                  placeholder="z.B. 190.00"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-4 border border-gray-200 rounded-xl text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}
          </div>
        </div>

        {/* Kleinteilpauschale */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
            <Percent className="w-4 h-4 text-teal-500" />
            <span className="text-sm font-semibold text-gray-700">Kleinteilpauschale</span>
            <button
              onClick={() => setKleinteilAktiv(v => !v)}
              className={cn(
                'ml-auto text-xs font-semibold px-3 py-1 rounded-full transition-all',
                kleinteilAktiv
                  ? 'bg-teal-100 text-teal-700'
                  : 'bg-gray-100 text-gray-500'
              )}
            >
              {kleinteilAktiv ? 'Aktiv' : 'Deaktiviert'}
            </button>
          </div>
          {kleinteilAktiv && (
            <div className="p-4 space-y-3">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setKleinteilModus('prozent')}
                  className={cn(
                    'flex-1 py-2 text-xs font-semibold rounded-md transition-all',
                    kleinteilModus === 'prozent' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'
                  )}
                >
                  % der Teile
                </button>
                <button
                  onClick={() => setKleinteilModus('fest')}
                  className={cn(
                    'flex-1 py-2 text-xs font-semibold rounded-md transition-all',
                    kleinteilModus === 'fest' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'
                  )}
                >
                  Festbetrag
                </button>
              </div>
              {kleinteilModus === 'prozent' ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Prozentsatz</label>
                    <div className="flex items-center border border-teal-200 rounded-xl bg-teal-50 overflow-hidden">
                      <input
                        type="number"
                        value={kleinteilProzent}
                        onChange={e => setKleinteilProzent(e.target.value)}
                        min="0"
                        max="100"
                        step="1"
                        className="flex-1 px-4 py-3 bg-transparent text-xl font-bold text-teal-700 text-center focus:outline-none"
                      />
                      <span className="pr-3 text-teal-500 font-bold">%</span>
                    </div>
                  </div>
                  <div className="text-gray-400 font-bold mt-5">=</div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Pauschale netto</label>
                    <div className="w-full px-4 py-3 border border-teal-200 rounded-xl text-xl font-bold text-teal-700 bg-teal-50 text-center">
                      {kleinteilNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Festbetrag netto (€)</label>
                  <input
                    type="number"
                    value={kleinteilFest}
                    onChange={e => setKleinteilFest(e.target.value)}
                    placeholder="z.B. 15.00"
                    min="0"
                    step="0.50"
                    className="w-full px-4 py-3 border border-teal-200 rounded-xl text-xl font-bold text-center text-teal-700 bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-400 bg-teal-50 rounded-lg px-3 py-2">
                <Info className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                Deckt Schrauben, Dichtungen, Reinigungsmittel und sonstige Kleinteile ab
              </div>
            </div>
          )}
        </div>

        {/* Sonstiges (optional) */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
            <Calculator className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-semibold text-gray-700">Sonstiges</span>
            <span className="ml-auto text-xs text-gray-400">Optional</span>
          </div>
          <div className="p-4">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Zusätzliche Kosten netto (€)</label>
            <input
              type="number"
              value={sonstiges}
              onChange={e => setSonstiges(e.target.value)}
              placeholder="z.B. Entsorgungsgebühr, HU-Gebühr..."
              min="0"
              step="0.01"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
        </div>

        {/* Gesamtvorschau */}
        <div className={cn(
          'rounded-xl border-2 p-4 space-y-2',
          gesamtBrutto > 0 ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'
        )}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Rechnungssumme</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Teile & Material (netto)</span>
              <span className="tabular-nums">{teileNettoAuto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Arbeitsleistung (netto)</span>
              <span className="tabular-nums">{arbeitNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
            </div>
            {kleinteilNetto > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Kleinteilpauschale (netto)</span>
                <span className="tabular-nums">{kleinteilNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
              </div>
            )}
            {sonstigesNetto > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Sonstiges (netto)</span>
                <span className="tabular-nums">{sonstigesNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600 border-t border-gray-200 pt-1.5">
              <span>Gesamt netto</span>
              <span className="tabular-nums">{gesamtNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
            </div>
            {!kleinunternehmer && (
              <div className="flex justify-between text-gray-600">
                <span>19% MwSt.</span>
                <span className="tabular-nums">{mwst.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg text-gray-900 border-t-2 border-gray-300 pt-2">
              <span>Gesamtbetrag {!kleinunternehmer ? '(brutto)' : ''}</span>
              <span className={cn('tabular-nums', gesamtBrutto > 0 ? 'text-green-700' : 'text-gray-300')}>
                {gesamtBrutto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Weiter-Button */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={weiterZumDruck}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-4 rounded-xl text-base transition-colors"
          >
            <Receipt className="w-5 h-5" />
            Rechnung drucken / als PDF
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
