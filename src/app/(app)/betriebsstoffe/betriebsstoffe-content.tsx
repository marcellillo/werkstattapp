'use client'
import { useState } from 'react'
import { Droplets, Plus, Pencil, Check, X, Loader2, PackagePlus, Trash2, Power } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DecimalField } from '@/components/ui/decimal-field'
import { createClient } from '@/lib/supabase/client'
import { useRollen } from '@/lib/rollen-context'
import {
  ladeBetriebsstoffeMitBestand, ladeBewegungen, formatMenge,
  type BetriebsstoffMitBestand, type BetriebsstoffBewegung,
} from '@/lib/betriebsstoffe'

interface Props {
  betriebId: string
  initialStoffe: BetriebsstoffMitBestand[]
  initialBewegungen: BetriebsstoffBewegung[]
}

const eur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export function BetriebsstoffeContent({ betriebId, initialStoffe, initialBewegungen }: Props) {
  const supabase = createClient()
  const { role } = useRollen()
  const istAdmin = role === 'admin' || role === 'superadmin'

  const [stoffe, setStoffe] = useState(initialStoffe)
  const [bewegungen, setBewegungen] = useState(initialBewegungen)
  const [tab, setTab] = useState<string>('alle')
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Zugang buchen: pro Stoff ein eigenes kleines Formular
  const [zugangOffen, setZugangOffen] = useState<string | null>(null)
  const [zugangMenge, setZugangMenge] = useState(0)
  const [zugangBemerkung, setZugangBemerkung] = useState('')

  // Preise ändern
  const [preisOffen, setPreisOffen] = useState<string | null>(null)
  const [preisVk, setPreisVk] = useState(0)
  const [preisEk, setPreisEk] = useState(0)

  // Neuer Stoff
  const [neuOffen, setNeuOffen] = useState(false)
  const [neuName, setNeuName] = useState('')
  const [neuEinheit, setNeuEinheit] = useState('L')
  const [neuVk, setNeuVk] = useState(0)
  const [neuEk, setNeuEk] = useState(0)

  async function neuLaden() {
    const [s, b] = await Promise.all([
      ladeBetriebsstoffeMitBestand(supabase, betriebId),
      ladeBewegungen(supabase, betriebId),
    ])
    setStoffe(s)
    setBewegungen(b)
  }

  async function zugangBuchen(stoff: BetriebsstoffMitBestand) {
    if (!zugangMenge) { setFehler('Bitte eine Literzahl eintragen (negativ = Korrektur / Verbrauch).'); return }
    setBusy(stoff.id); setFehler(null)
    const { error } = await supabase.from('betriebsstoff_zugaenge').insert({
      betrieb_id: betriebId,
      betriebsstoff_id: stoff.id,
      menge: zugangMenge,
      bemerkung: zugangBemerkung.trim() || null,
    })
    setBusy(null)
    if (error) { setFehler(`Zugang konnte nicht gebucht werden: ${error.message}`); return }
    setZugangOffen(null); setZugangMenge(0); setZugangBemerkung('')
    await neuLaden()
  }

  async function preiseSpeichern(stoff: BetriebsstoffMitBestand) {
    setBusy(stoff.id); setFehler(null)
    const { data, error } = await supabase
      .from('betriebsstoffe')
      .update({ preis_pro_einheit: preisVk, einkaufspreis_pro_einheit: preisEk > 0 ? preisEk : null })
      .eq('id', stoff.id)
      .select('id')
    setBusy(null)
    if (error) { setFehler(`Preis konnte nicht gespeichert werden: ${error.message}`); return }
    if (!data?.length) { setFehler('Keine Berechtigung zum Ändern dieses Betriebsstoffs.'); return }
    setPreisOffen(null)
    await neuLaden()
  }

  async function aktivUmschalten(stoff: BetriebsstoffMitBestand) {
    setBusy(stoff.id); setFehler(null)
    const { data, error } = await supabase.from('betriebsstoffe').update({ aktiv: !stoff.aktiv }).eq('id', stoff.id).select('id')
    setBusy(null)
    if (error) { setFehler(`Status konnte nicht geändert werden: ${error.message}`); return }
    if (!data?.length) { setFehler('Keine Berechtigung zum Ändern dieses Betriebsstoffs.'); return }
    await neuLaden()
  }

  async function stoffAnlegen() {
    if (!neuName.trim()) { setFehler('Bitte einen Namen eintragen.'); return }
    setBusy('neu'); setFehler(null)
    const { error } = await supabase.from('betriebsstoffe').insert({
      betrieb_id: betriebId,
      name: neuName.trim(),
      einheit: neuEinheit.trim() || 'L',
      preis_pro_einheit: neuVk,
      einkaufspreis_pro_einheit: neuEk > 0 ? neuEk : null,
      sortierung: stoffe.length + 1,
    })
    setBusy(null)
    if (error) {
      setFehler(error.code === '23505' ? `„${neuName.trim()}“ gibt es schon.` : `Anlegen fehlgeschlagen: ${error.message}`)
      return
    }
    setNeuOffen(false); setNeuName(''); setNeuEinheit('L'); setNeuVk(0); setNeuEk(0)
    await neuLaden()
  }

  async function zugangLoeschen(b: BetriebsstoffBewegung) {
    if (!b.zugangId) return
    if (!confirm(`Zugang „${b.stoffName}“ (${formatMenge(b.menge, b.einheit)}) wirklich löschen?`)) return
    setBusy(b.id); setFehler(null)
    const { error, count } = await supabase.from('betriebsstoff_zugaenge').delete({ count: 'exact' }).eq('id', b.zugangId)
    setBusy(null)
    if (error) { setFehler(`Löschen fehlgeschlagen: ${error.message}`); return }
    if (!count) { setFehler('Keine Berechtigung zum Löschen (nur Admin).'); return }
    await neuLaden()
  }

  // Reiter: "Alle" oder ein einzelner Stoff (fällt auf "Alle" zurück, falls der Stoff nicht mehr existiert)
  const aktiverTab = tab !== 'alle' && stoffe.some(s => s.id === tab) ? tab : 'alle'
  const sichtbareStoffe = aktiverTab === 'alle' ? stoffe : stoffe.filter(s => s.id === aktiverTab)
  const sichtbareBewegungen = aktiverTab === 'alle' ? bewegungen : bewegungen.filter(b => b.betriebsstoffId === aktiverTab)

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Droplets className="w-6 h-6 text-sky-500" /> Betriebsstoffe
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">Öl, Wischwasser & Co. — Literpreis, Bestand und was davon verkauft wurde</p>
        </div>
        <Button onClick={() => setNeuOffen(v => !v)} className="bg-sky-600 hover:bg-sky-700 text-white">
          <Plus className="w-4 h-4 mr-2" />Neuer Betriebsstoff
        </Button>
      </div>

      {fehler && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
          <span>{fehler}</span>
          <button onClick={() => setFehler(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {neuOffen && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Neuen Betriebsstoff anlegen</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-gray-700 mb-1 block">Name *</label>
                <input value={neuName} onChange={e => setNeuName(e.target.value)} placeholder="z.B. Kühlmittel, Bremsflüssigkeit, AdBlue"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-gray-700 mb-1 block">Einheit</label>
                <input value={neuEinheit} onChange={e => setNeuEinheit(e.target.value)} placeholder="L"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
              <div>
                <label className="text-xs text-gray-700 mb-1 block">Verkaufspreis je Einheit (netto, €)</label>
                <DecimalField value={neuVk} onChange={setNeuVk} placeholder="26,00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
              <div>
                <label className="text-xs text-gray-700 mb-1 block">Einkaufspreis je Einheit (optional, für die Statistik)</label>
                <DecimalField value={neuEk} onChange={setNeuEk} placeholder="z.B. 12,00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={stoffAnlegen} disabled={busy === 'neu'} className="bg-sky-600 hover:bg-sky-700 text-white">
                {busy === 'neu' ? 'Speichern…' : 'Anlegen'}
              </Button>
              <Button variant="ghost" onClick={() => setNeuOffen(false)}>Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stoffe.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Betriebsstoffe">
          {[{ id: 'alle', name: 'Alle', rest: null as number | null, einheit: '', aktiv: true }, ...stoffe].map(s => {
            const ausgewaehlt = aktiverTab === s.id
            const leer = s.rest != null && s.rest <= 0
            return (
              <button key={s.id} role="tab" aria-selected={ausgewaehlt} onClick={() => setTab(s.id)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl border text-left transition-colors ${
                  ausgewaehlt ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-sky-300'
                } ${s.aktiv ? '' : 'opacity-60'}`}>
                <span className="block text-sm font-medium whitespace-nowrap">{s.name}</span>
                {s.rest != null && (
                  <span className={`block text-xs tabular-nums ${ausgewaehlt ? 'text-sky-100' : leer ? 'text-red-600' : 'text-gray-500'}`}>
                    {formatMenge(s.rest, s.einheit)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {stoffe.length === 0 && (
        <Card><CardContent className="py-12 text-center text-gray-500">
          <Droplets className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          Noch keine Betriebsstoffe angelegt.
        </CardContent></Card>
      )}

      <div className="space-y-4">
        {sichtbareStoffe.map(s => {
          const anteilRest = s.zugang > 0 ? Math.max(0, Math.min(100, (s.rest / s.zugang) * 100)) : 0
          const leer = s.rest <= 0
          return (
            <Card key={s.id} className={s.aktiv ? '' : 'opacity-60'}>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                      {s.name}
                      {!s.aktiv && <span className="text-xs font-normal bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">deaktiviert</span>}
                    </p>
                    {preisOffen === s.id ? (
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <div>
                          <label className="text-xs text-gray-600 block mb-0.5">VK netto / {s.einheit}</label>
                          <DecimalField value={preisVk} onChange={setPreisVk}
                            className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-0.5">EK netto / {s.einheit} (optional)</label>
                          <DecimalField value={preisEk} onChange={setPreisEk}
                            className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                        </div>
                        <button onClick={() => preiseSpeichern(s)} disabled={busy === s.id} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Speichern">
                          {busy === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setPreisOffen(null)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Abbrechen"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-2 flex-wrap">
                        {s.preis_pro_einheit > 0
                          ? <span><strong>{eur(s.preis_pro_einheit)}</strong> / {s.einheit} netto</span>
                          : <span className="text-amber-600 font-medium">Preis fehlt — mit dem Stift eintragen</span>}
                        {s.einkaufspreis_pro_einheit != null && <span className="text-gray-400">· EK {eur(s.einkaufspreis_pro_einheit)}</span>}
                        <button
                          onClick={() => { setPreisOffen(s.id); setPreisVk(s.preis_pro_einheit); setPreisEk(s.einkaufspreis_pro_einheit ?? 0) }}
                          className="p-1 text-gray-400 hover:text-gray-700 rounded" title="Preis ändern"
                        ><Pencil className="w-3.5 h-3.5" /></button>
                      </p>
                    )}
                  </div>
                  <button onClick={() => aktivUmschalten(s)} disabled={busy === s.id}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title={s.aktiv ? 'Deaktivieren (nicht mehr auf der Rechnung auswählbar)' : 'Wieder aktivieren'}>
                    <Power className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-50 rounded-xl py-3">
                    <p className="text-xs text-gray-500">Eingelagert</p>
                    <p className="text-xl font-bold text-gray-900 tabular-nums">{formatMenge(s.zugang, s.einheit)}</p>
                  </div>
                  <div className="bg-sky-50 rounded-xl py-3">
                    <p className="text-xs text-sky-700">Verkauft</p>
                    <p className="text-xl font-bold text-sky-900 tabular-nums">{formatMenge(s.verkauft, s.einheit)}</p>
                    <p className="text-[11px] text-sky-600">{eur(s.verkauft * s.preis_pro_einheit)}</p>
                  </div>
                  <div className={leer ? 'bg-red-50 rounded-xl py-3' : 'bg-green-50 rounded-xl py-3'}>
                    <p className={leer ? 'text-xs text-red-700' : 'text-xs text-green-700'}>Noch übrig</p>
                    <p className={`text-xl font-bold tabular-nums ${leer ? 'text-red-700' : 'text-green-800'}`}>{formatMenge(s.rest, s.einheit)}</p>
                  </div>
                </div>

                <div className="h-2 rounded-full bg-gray-100 overflow-hidden" title={`${anteilRest.toFixed(0)} % übrig`}>
                  <div className={`h-full ${leer ? 'bg-red-400' : anteilRest < 20 ? 'bg-amber-400' : 'bg-green-500'}`} style={{ width: `${anteilRest}%` }} />
                </div>

                {zugangOffen === s.id ? (
                  <div className="border border-sky-200 bg-sky-50 rounded-xl p-3 space-y-2">
                    <p className="text-sm font-medium text-sky-900">Zugang buchen</p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div>
                        <label className="text-xs text-gray-600 block mb-0.5">Liter (negativ = Korrektur)</label>
                        <DecimalField value={zugangMenge} onChange={setZugangMenge} placeholder="z.B. 60"
                          className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
                      </div>
                      <div className="flex-1 min-w-[160px]">
                        <label className="text-xs text-gray-600 block mb-0.5">Bemerkung (optional)</label>
                        <input value={zugangBemerkung} onChange={e => setZugangBemerkung(e.target.value)} placeholder="z.B. Fass LKQ, Anfangsbestand"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
                      </div>
                      <Button onClick={() => zugangBuchen(s)} disabled={busy === s.id} className="bg-sky-600 hover:bg-sky-700 text-white">
                        {busy === s.id ? 'Buchen…' : 'Buchen'}
                      </Button>
                      <Button variant="ghost" onClick={() => setZugangOffen(null)}>Abbrechen</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => { setZugangOffen(s.id); setZugangMenge(0); setZugangBemerkung('') }}>
                    <PackagePlus className="w-4 h-4 mr-2" />Zugang buchen
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {sichtbareBewegungen.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Verlauf</h3>
            <div className="divide-y divide-gray-100">
              {sichtbareBewegungen.map(b => (
                <div key={b.id} className={`flex items-center gap-3 py-2 text-sm ${b.storniert ? 'opacity-50' : ''}`}>
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">{new Date(b.datum).toLocaleDateString('de-DE')}</span>
                  <span className="flex-1 min-w-0 truncate">
                    <span className="font-medium text-gray-800">{b.stoffName}</span>
                    <span className="text-gray-500"> · {b.quelle}{b.storniert ? ' (storniert, Liter wieder im Bestand)' : ''}</span>
                  </span>
                  <span className={`tabular-nums font-medium ${b.menge >= 0 ? 'text-green-700' : 'text-sky-800'} ${b.storniert ? 'line-through' : ''}`}>
                    {b.menge > 0 ? '+' : ''}{formatMenge(b.menge, b.einheit)}
                  </span>
                  {b.art === 'zugang' && istAdmin && (
                    <button onClick={() => zugangLoeschen(b)} disabled={busy === b.id} className="p-1 text-gray-300 hover:text-red-600" title="Zugang löschen">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
