'use client'
import { useState, useEffect } from 'react'
import { Receipt, ChevronRight, Percent, Calculator, Loader2, Droplets } from 'lucide-react'
import { RechnungDruck } from './rechnung-druck'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { mitAufschlag } from '@/lib/ersatzteil-aufschlag'
import { DecimalField } from '@/components/ui/decimal-field'
import { ladeBetriebsstoffeMitBestand, formatMenge, rundeBetrag, type BetriebsstoffMitBestand } from '@/lib/betriebsstoffe'

// Komma- und Punkt-Eingabe ("4,5" / "4.5") zulassen; native type="number"-Felder blockieren das Komma
const zahl = (s: string) => parseFloat(s.replace(',', '.')) || 0
const nurZahlZeichen = (s: string) => s.replace(/[^0-9,.]/g, '')

interface Props {
  auftrag: any
  firma: Record<string, string>
  betriebId: string
}

interface OffenerPosten {
  id: string
  nummer: string
  summe: number
  auto?: boolean
  positionId?: string
  stunden?: number
  satz?: number
}

export function RechnungFlow({ auftrag, firma, betriebId }: Props) {
  const kleinunternehmer = firma.firma_kleinunternehmer === 'ja'

  const [loading, setLoading] = useState(true)
  const [offeneKvs, setOffeneKvs] = useState<OffenerPosten[]>([])
  const [offeneWas, setOffeneWas] = useState<OffenerPosten[]>([])
  const [selectedKvIds, setSelectedKvIds] = useState<Set<string>>(new Set())
  const [selectedWaIds, setSelectedWaIds] = useState<Set<string>>(new Set())

  const [anzeigeModus, setAnzeigeModus] = useState<'detailliert' | 'pauschal'>('detailliert')

  const [kleinteilAktiv, setKleinteilAktiv] = useState(false)
  const [kleinteilModus, setKleinteilModus] = useState<'prozent' | 'fest'>('fest')
  const [kleinteilProzent, setKleinteilProzent] = useState('10')
  const [kleinteilFest, setKleinteilFest] = useState('11')
  const [sonstigesBeschreibung, setSonstigesBeschreibung] = useState('')
  const [sonstiges, setSonstiges] = useState('')

  const [betriebsstoffe, setBetriebsstoffe] = useState<BetriebsstoffMitBestand[]>([])
  const [bsMengen, setBsMengen] = useState<Record<string, number>>({})

  const [erstellenLaeuft, setErstellenLaeuft] = useState(false)
  const [rechnungId, setRechnungId] = useState<string | null>(null)

  useEffect(() => {
    loadOffenePosten()
  }, [])

  const loadOffenePosten = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const [{ data: kvRows }, { data: waRows }] = await Promise.all([
        supabase
          .from('kostenvoranschlaege')
          .select('id, nummer, ersatzteile_modus, ersatzteile_festpreis, positionen:kostenvoranschlag_position(gesamtpreis)')
          .eq('auftrag_id', auftrag.id)
          .eq('betrieb_id', betriebId)
          .is('rechnung_id', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('werkstattauftraege')
          .select('id, nummer, positionen:werkstattauftrag_positionen(gesamtpreis)')
          .eq('auftrag_id', auftrag.id)
          .eq('betrieb_id', betriebId)
          .is('rechnung_id', null)
          .order('created_at', { ascending: false }),
      ])

      let kvs: OffenerPosten[] = (kvRows || []).map((kv: any) => ({
        id: kv.id,
        nummer: kv.nummer,
        summe: kv.ersatzteile_modus === 'festpreis'
          ? (kv.ersatzteile_festpreis || 0)
          : (kv.positionen || []).reduce((s: number, p: any) => s + (p.gesamtpreis || 0), 0),
      }))

      // Bereits erfasste Ersatzteile (aus der Ersatzteile-Liste bzw. dem Lieferschein-
      // Scanner), die noch in keinem Kostenvoranschlag stecken, automatisch übernehmen —
      // statt sie ein zweites Mal manuell im Kostenvoranschlag eintippen zu müssen. Bereits
      // übernommene Teile werden über kostenvoranschlag_position.ersatzteil_id erkannt und
      // nie ein zweites Mal (doppelt) abgerechnet.
      const alleTeile: any[] = auftrag.ersatzteile || []
      if (alleTeile.length > 0) {
        try {
          const { data: bereitsUebernommen } = await supabase
            .from('kostenvoranschlag_position')
            .select('ersatzteil_id')
            .not('ersatzteil_id', 'is', null)
            .in('ersatzteil_id', alleTeile.map(t => t.id))
          const uebernommenIds = new Set((bereitsUebernommen || []).map((r: any) => r.ersatzteil_id))
          const neueTeile = alleTeile.filter(t => !uebernommenIds.has(t.id))

          if (neueTeile.length > 0) {
            let zielKvId: string | null = kvRows?.[0]?.id ?? null
            if (!zielKvId) {
              const createRes = await fetch('/api/kostenvoranschlag/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auftragId: auftrag.id, betriebId, fahrzeugId: auftrag.fahrzeug?.id, typ: 'werkstatt' }),
              })
              const createData = await createRes.json()
              if (createRes.ok && createData.kostenvoranschlag) zielKvId = createData.kostenvoranschlag.id
            }

            if (zielKvId) {
              const positionen = neueTeile.map(t => {
                const einzelpreis = t.einzelpreis ? mitAufschlag(t.einzelpreis) : undefined
                const gesamtpreis = einzelpreis ? einzelpreis * (t.menge || 1) : undefined
                return {
                  kostenvoranschlag_id: zielKvId, betrieb_id: betriebId, ersatzteil_id: t.id,
                  beschreibung: t.bezeichnung || '', menge: t.menge || 1,
                  ...(einzelpreis && { einzelpreis }), ...(gesamtpreis && { gesamtpreis }),
                  // Der Einkaufspreis aus dem Lieferschein geht sonst nach dem Aufschlag verloren
                  ...(t.einzelpreis && { einkaufspreis: t.einzelpreis }),
                }
              })
              await supabase.from('kostenvoranschlag_position').insert(positionen)
              await supabase.from('kostenvoranschlaege').update({ ersatzteile_modus: 'einzeln' }).eq('id', zielKvId)

              // Endgültigen Stand neu laden, damit Summen korrekt sind
              const { data: kvRowsNeu } = await supabase
                .from('kostenvoranschlaege')
                .select('id, nummer, ersatzteile_modus, ersatzteile_festpreis, positionen:kostenvoranschlag_position(gesamtpreis)')
                .eq('auftrag_id', auftrag.id)
                .eq('betrieb_id', betriebId)
                .is('rechnung_id', null)
                .order('created_at', { ascending: false })
              kvs = (kvRowsNeu || []).map((kv: any) => ({
                id: kv.id,
                nummer: kv.nummer,
                auto: kv.id === zielKvId,
                summe: kv.ersatzteile_modus === 'festpreis'
                  ? (kv.ersatzteile_festpreis || 0)
                  : (kv.positionen || []).reduce((s: number, p: any) => s + (p.gesamtpreis || 0), 0),
              }))
            }
          }
        } catch (autoError) {
          console.error('[RechnungFlow] Automatisches Übernehmen der Ersatzteile fehlgeschlagen:', autoError)
        }
      }

      let was: OffenerPosten[] = (waRows || []).map((wa: any) => ({
        id: wa.id,
        nummer: wa.nummer,
        summe: (wa.positionen || []).reduce((s: number, p: any) => s + (p.gesamtpreis || 0), 0),
      }))

      // Kein Werkstattauftrag vorhanden, aber vereinbarte Arbeiten am Auftrag hinterlegt:
      // automatisch einen mit einer Startposition (1 Std. zum hinterlegten Stundensatz)
      // anlegen, statt den Nutzer vor der Rechnung extra daran erinnern zu müssen.
      if (was.length === 0 && auftrag.arbeiten?.trim()) {
        const stundensatz = parseFloat(firma.firma_stundensatz) || 0
        try {
          const createRes = await fetch('/api/werkstattauftrag/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auftragId: auftrag.id, betriebId, fahrzeugId: auftrag.fahrzeug?.id }),
          })
          const createData = await createRes.json()
          if (createRes.ok && createData.werkstattauftrag) {
            const { data: pos } = await supabase.from('werkstattauftrag_positionen').insert({
              werkstattauftrag_id: createData.werkstattauftrag.id,
              betrieb_id: betriebId,
              beschreibung: auftrag.arbeiten,
              menge: 1,
              einzelpreis: stundensatz,
              gesamtpreis: stundensatz,
            }).select().single()
            was = [{
              id: createData.werkstattauftrag.id,
              nummer: createData.werkstattauftrag.nummer,
              summe: pos?.gesamtpreis ?? stundensatz,
              auto: true,
              positionId: pos?.id,
              stunden: 1,
              satz: stundensatz,
            }]
          }
        } catch (autoError) {
          console.error('[RechnungFlow] Automatisches Anlegen des Werkstattauftrags fehlgeschlagen:', autoError)
        }
      }

      try {
        setBetriebsstoffe(await ladeBetriebsstoffeMitBestand(supabase, betriebId, { nurAktive: true }))
      } catch (bsError) {
        console.error('[RechnungFlow] Betriebsstoffe konnten nicht geladen werden:', bsError)
      }

      setOffeneKvs(kvs)
      setOffeneWas(was)
      setSelectedKvIds(new Set(kvs.map(k => k.id)))
      setSelectedWaIds(new Set(was.map(w => w.id)))
    } catch (error) {
      console.error('[RechnungFlow] Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleKv = (id: string) => {
    setSelectedKvIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleWa = (id: string) => {
    setSelectedWaIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const updateAutoPosition = async (wa: OffenerPosten, patch: { stunden?: number; satz?: number }) => {
    if (!wa.positionId) return
    const stunden = patch.stunden ?? wa.stunden ?? 0
    const satz = patch.satz ?? wa.satz ?? 0
    if (stunden < 0 || satz < 0) return
    const gesamtpreis = stunden * satz
    setOffeneWas(prev => prev.map(w => w.id === wa.id ? { ...w, stunden, satz, summe: gesamtpreis } : w))
    const supabase = createClient()
    await supabase.from('werkstattauftrag_positionen').update({ menge: stunden, einzelpreis: satz, gesamtpreis }).eq('id', wa.positionId)
  }

  const ersatzteileNetto = offeneKvs.filter(k => selectedKvIds.has(k.id)).reduce((s, k) => s + k.summe, 0)
  const arbeitNetto = offeneWas.filter(w => selectedWaIds.has(w.id)).reduce((s, w) => s + w.summe, 0)
  const sonstigesNetto = zahl(sonstiges)
  const kleinteilNetto = kleinteilAktiv
    ? (kleinteilModus === 'prozent'
        ? ersatzteileNetto * zahl(kleinteilProzent) / 100
        : zahl(kleinteilFest))
    : 0

  const betriebsstoffeNetto = betriebsstoffe.reduce(
    (s, b) => s + rundeBetrag((bsMengen[b.id] || 0) * b.preis_pro_einheit), 0)

  const gesamtNetto = ersatzteileNetto + arbeitNetto + sonstigesNetto + kleinteilNetto + betriebsstoffeNetto
  const mwst = kleinunternehmer ? 0 : gesamtNetto * 0.19
  const gesamtBrutto = gesamtNetto + mwst

  const nichtsAusgewaehlt = selectedKvIds.size === 0 && selectedWaIds.size === 0 && kleinteilNetto <= 0 && sonstigesNetto <= 0 && betriebsstoffeNetto <= 0

  async function rechnungErstellen() {
    setErstellenLaeuft(true)
    try {
      const res = await fetch('/api/rechnung/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auftragId: auftrag.id,
          betriebId,
          fahrzeugId: auftrag.fahrzeug?.id,
          kostenvoranschlagIds: Array.from(selectedKvIds),
          werkstattauftragIds: Array.from(selectedWaIds),
          kleinteilpauschaleBetrag: kleinteilNetto > 0 ? kleinteilNetto : undefined,
          sonstigesBeschreibung: sonstigesNetto > 0 ? (sonstigesBeschreibung || undefined) : undefined,
          sonstigesBetrag: sonstigesNetto > 0 ? sonstigesNetto : undefined,
          betriebsstoffe: betriebsstoffe
            .filter(b => (bsMengen[b.id] || 0) > 0)
            .map(b => ({ betriebsstoffId: b.id, menge: bsMengen[b.id] })),
          anzeigeModus,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fehler beim Erstellen der Rechnung')
      setRechnungId(data.rechnung.id)
    } catch (e: any) {
      alert(e.message || 'Fehler beim Erstellen der Rechnung')
    } finally {
      setErstellenLaeuft(false)
    }
  }

  if (rechnungId) {
    return <RechnungDruck rechnungId={rechnungId} betriebId={betriebId} firma={firma} />
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
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Wird geladen...
          </div>
        ) : (
          <>
            {/* Kostenvoranschläge */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">📋 Kostenvoranschläge (Ersatzteile)</span>
              </div>
              {offeneKvs.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-400 italic">Keine offenen Kostenvoranschläge</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {offeneKvs.map(kv => (
                    <label key={kv.id} className="flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer hover:bg-gray-50">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={selectedKvIds.has(kv.id)} onChange={() => toggleKv(kv.id)} className="w-4 h-4" />
                        {kv.nummer}
                        {kv.auto && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Ersatzteile automatisch übernommen</span>}
                      </span>
                      <span className="font-medium text-gray-700 tabular-nums">{kv.summe.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                    </label>
                  ))}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm font-semibold">
                    <span className="text-gray-600">Ersatzteile ausgewählt (netto)</span>
                    <span className="text-gray-900 tabular-nums">{ersatzteileNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                  </div>
                </div>
              )}
            </div>

            {/* Werkstattaufträge */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">🔧 Werkstattaufträge (Arbeitszeit)</span>
              </div>
              {offeneWas.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-400 italic">Keine offenen Werkstattaufträge</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {offeneWas.map(wa => (
                    <div key={wa.id} className="px-4 py-2.5">
                      <label className="flex items-center justify-between text-sm cursor-pointer">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={selectedWaIds.has(wa.id)} onChange={() => toggleWa(wa.id)} className="w-4 h-4" />
                          {wa.nummer}
                          {wa.auto && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">automatisch aus Auftrag übernommen</span>}
                        </span>
                        <span className="font-medium text-gray-700 tabular-nums">{wa.summe.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                      </label>
                      {wa.auto && (
                        <div className="flex items-center gap-2 mt-1.5 pl-6">
                          <label className="text-xs text-gray-500">Stunden:</label>
                          <DecimalField value={wa.stunden ?? 1}
                            onChange={n => updateAutoPosition(wa, { stunden: n })}
                            className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs" />
                          <label className="text-xs text-gray-500">€/Std:</label>
                          <DecimalField value={wa.satz ?? 0}
                            onChange={n => updateAutoPosition(wa, { satz: n })}
                            className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-xs" />
                          {!wa.satz && <span className="text-xs text-amber-600">Stundensatz fehlt — bitte eintragen oder unter Einstellungen hinterlegen</span>}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm font-semibold">
                    <span className="text-gray-600">Arbeitszeit ausgewählt (netto)</span>
                    <span className="text-gray-900 tabular-nums">{arbeitNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                  </div>
                </div>
              )}
            </div>

            {/* Betriebsstoffe (Motoröl, Wischwasser, ...) */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <Droplets className="w-4 h-4 text-sky-500" />
                <span className="text-sm font-semibold text-gray-700">Betriebsstoffe (eingefüllt)</span>
                <span className="ml-auto text-xs text-gray-400">Liter eintragen</span>
              </div>
              {betriebsstoffe.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-400 italic">
                  Noch keine Betriebsstoffe angelegt — unter „Betriebsstoffe“ im Menü Motoröl, Wischwasser usw. mit Literpreis anlegen.
                </p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {betriebsstoffe.map(b => {
                    const menge = bsMengen[b.id] || 0
                    const zuViel = menge > b.rest
                    const ohnePreis = b.preis_pro_einheit <= 0
                    return (
                      <div key={b.id} className={cn('px-4 py-3', ohnePreis && 'bg-gray-50/60')}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800">{b.name}</p>
                            {ohnePreis ? (
                              <p className="text-xs text-amber-600">Preis fehlt — unter „Betriebsstoffe“ im Menü festlegen</p>
                            ) : (
                              <p className="text-xs text-gray-500">
                                {b.preis_pro_einheit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € / {b.einheit} netto
                                {' · '}Bestand: <span className={cn('font-medium', b.rest <= 0 ? 'text-red-600' : 'text-gray-700')}>{formatMenge(b.rest, b.einheit)}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <DecimalField
                              placeholder="0"
                              value={menge}
                              onChange={n => setBsMengen(prev => ({ ...prev, [b.id]: ohnePreis || n < 0 ? 0 : n }))}
                              className={cn('w-20 px-2 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-sky-400', ohnePreis && 'opacity-40 pointer-events-none')}
                            />
                            <span className="text-xs text-gray-500 w-4">{b.einheit}</span>
                          </div>
                        </div>
                        {menge > 0 && (
                          <div className="flex items-center justify-between mt-1.5 text-xs">
                            <span className={zuViel ? 'text-amber-600' : 'text-gray-400'}>
                              {zuViel
                                ? `Achtung: laut Bestand nur noch ${formatMenge(Math.max(b.rest, 0), b.einheit)} da — wird trotzdem berechnet`
                                : `danach noch ${formatMenge(rundeBetrag(b.rest - menge), b.einheit)}`}
                            </span>
                            <span className="font-medium text-gray-700 tabular-nums">
                              {rundeBetrag(menge * b.preis_pro_einheit).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm font-semibold">
                    <span className="text-gray-600">Betriebsstoffe (netto)</span>
                    <span className="text-gray-900 tabular-nums">{betriebsstoffeNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                  </div>
                </div>
              )}
            </div>

            {/* Kleinteilpauschale */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <Percent className="w-4 h-4 text-teal-500" />
                <span className="text-sm font-semibold text-gray-700">Kleinteilpauschale</span>
                <button
                  onClick={() => setKleinteilAktiv(v => !v)}
                  className={cn('ml-auto text-xs font-semibold px-3 py-1 rounded-full transition-all',
                    kleinteilAktiv ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500')}
                >
                  {kleinteilAktiv ? 'Aktiv' : 'Deaktiviert'}
                </button>
              </div>
              {kleinteilAktiv && (
                <div className="p-4 space-y-3">
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    <button onClick={() => setKleinteilModus('prozent')} className={cn('flex-1 py-2 text-xs font-semibold rounded-md transition-all', kleinteilModus === 'prozent' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500')}>% der Teile</button>
                    <button onClick={() => setKleinteilModus('fest')} className={cn('flex-1 py-2 text-xs font-semibold rounded-md transition-all', kleinteilModus === 'fest' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500')}>Festbetrag</button>
                  </div>
                  {kleinteilModus === 'prozent' ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Prozentsatz</label>
                        <div className="flex items-center border border-teal-200 rounded-xl bg-teal-50 overflow-hidden">
                          <input type="text" inputMode="decimal" value={kleinteilProzent} onChange={e => setKleinteilProzent(nurZahlZeichen(e.target.value))} className="flex-1 px-4 py-3 bg-transparent text-xl font-bold text-teal-700 text-center focus:outline-none" />
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
                      <input type="text" inputMode="decimal" value={kleinteilFest} onChange={e => setKleinteilFest(nurZahlZeichen(e.target.value))} placeholder="z.B. 15,00" className="w-full px-4 py-3 border border-teal-200 rounded-xl text-xl font-bold text-center text-teal-700 bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sonstiges */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <Calculator className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-semibold text-gray-700">Sonstiges</span>
                <span className="ml-auto text-xs text-gray-400">Optional</span>
              </div>
              <div className="p-4 space-y-2">
                <input
                  type="text"
                  value={sonstigesBeschreibung}
                  onChange={e => setSonstigesBeschreibung(e.target.value)}
                  placeholder="Bezeichnung, z.B. Entsorgungsgebühr, HU-Gebühr..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={sonstiges}
                  onChange={e => setSonstiges(nurZahlZeichen(e.target.value))}
                  placeholder="Betrag netto (€)"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
            </div>

            {/* Anzeige-Modus */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">Darstellung</span>
              </div>
              <div className="p-4 flex gap-2">
                <button type="button" onClick={() => setAnzeigeModus('detailliert')}
                  className={cn('flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors text-left px-3',
                    anzeigeModus === 'detailliert' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-600')}>
                  Detailliert<br /><span className="text-xs font-normal opacity-70">mit Einzelpreisen je Position</span>
                </button>
                <button type="button" onClick={() => setAnzeigeModus('pauschal')}
                  className={cn('flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors text-left px-3',
                    anzeigeModus === 'pauschal' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-600')}>
                  Pauschal<br /><span className="text-xs font-normal opacity-70">nur Bezeichnungen, ohne Einzelpreise</span>
                </button>
              </div>
            </div>

            {/* Gesamtvorschau */}
            <div className={cn('rounded-xl border-2 p-4 space-y-2', gesamtBrutto > 0 ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50')}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Rechnungssumme</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Ersatzteile (netto)</span>
                  <span className="tabular-nums">{ersatzteileNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Arbeitszeit (netto)</span>
                  <span className="tabular-nums">{arbeitNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                </div>
                {betriebsstoffeNetto > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Betriebsstoffe (netto)</span>
                    <span className="tabular-nums">{betriebsstoffeNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                  </div>
                )}
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
          </>
        )}
      </div>

      {/* Weiter-Button */}
      {!loading && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4">
          <div className="max-w-lg mx-auto">
            <button
              onClick={rechnungErstellen}
              disabled={nichtsAusgewaehlt || erstellenLaeuft}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-base transition-colors"
            >
              {erstellenLaeuft ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Wird erstellt...
                </>
              ) : (
                <>
                  <Receipt className="w-5 h-5" />
                  Rechnung erstellen & drucken
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
