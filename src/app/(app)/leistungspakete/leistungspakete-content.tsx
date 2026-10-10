'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PackagePlus, Pencil, Plus, Trash2, Wrench, Package, X, Loader2, Droplets } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Position { id?: string; art: 'teil' | 'arbeit'; beschreibung: string; menge: string; einzelpreis: string }
interface StoffZeile { betriebsstoff_id: string; menge: string }
interface Entwurf { id?: string; name: string; beschreibung: string; positionen: Position[]; stoffe: StoffZeile[] }

const euro = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const zahl = (s: string) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : NaN }
const textZahl = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

export function LeistungspaketeContent({ betriebId, pakete, betriebsstoffe, stundensatz, istAdmin }: {
  betriebId: string
  pakete: any[]
  betriebsstoffe: { id: string; name: string; einheit: string; aktiv: boolean }[]
  stundensatz: number | null
  istAdmin: boolean
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null)
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [loeschenId, setLoeschenId] = useState<string | null>(null)

  function neu() {
    setFehler(null)
    setEntwurf({ name: '', beschreibung: '', stoffe: [], positionen: [{ art: 'teil', beschreibung: '', menge: '1', einzelpreis: '' }, { art: 'arbeit', beschreibung: '', menge: '1', einzelpreis: '' }] })
  }
  const stoffName = (id: string) => betriebsstoffe.find(s => s.id === id)?.name ?? 'Betriebsstoff'
  const stoffEinheit = (id: string) => betriebsstoffe.find(s => s.id === id)?.einheit ?? 'L'
  function bearbeiten(p: any) {
    setFehler(null)
    setEntwurf({
      id: p.id, name: p.name, beschreibung: p.beschreibung ?? '',
      stoffe: (p.betriebsstoffe ?? []).map((b: any) => ({ betriebsstoff_id: b.betriebsstoff_id, menge: textZahl(Number(b.menge)) })),
      positionen: [...(p.positionen ?? [])].sort((a: any, b: any) => a.sortierung - b.sortierung)
        .map((x: any) => ({ id: x.id, art: x.art, beschreibung: x.beschreibung, menge: textZahl(Number(x.menge)), einzelpreis: textZahl(x.einzelpreis) })),
    })
  }
  const setPos = (i: number, patch: Partial<Position>) =>
    setEntwurf(e => e && ({ ...e, positionen: e.positionen.map((p, k) => (k === i ? { ...p, ...patch } : p)) }))

  async function speichern() {
    if (!entwurf) return
    setFehler(null)
    const name = entwurf.name.trim()
    if (!name) return setFehler('Bitte einen Namen eingeben.')
    const pos = entwurf.positionen.filter(p => p.beschreibung.trim())
    const stoffe = entwurf.stoffe.filter(s => s.betriebsstoff_id)
    if (!pos.length && !stoffe.length) return setFehler('Bitte mindestens eine Position oder einen Betriebsstoff eintragen.')
    for (const p of pos) {
      const m = zahl(p.menge)
      if (!(m > 0)) return setFehler(`„${p.beschreibung}“: Menge muss größer als 0 sein.`)
      if (p.einzelpreis.trim() !== '' && !(zahl(p.einzelpreis) >= 0)) return setFehler(`„${p.beschreibung}“: Preis ungültig.`)
    }
    const gesehen = new Set<string>()
    for (const s of stoffe) {
      if (!(zahl(s.menge) > 0 && zahl(s.menge) <= 1000)) return setFehler(`„${stoffName(s.betriebsstoff_id)}“: Menge muss zwischen 0 und 1000 liegen.`)
      if (gesehen.has(s.betriebsstoff_id)) return setFehler(`„${stoffName(s.betriebsstoff_id)}“ ist doppelt eingetragen.`)
      gesehen.add(s.betriebsstoff_id)
    }
    setSpeichert(true)
    try {
      let paketId = entwurf.id
      if (paketId) {
        const { error } = await supabase.from('leistungspakete').update({ name, beschreibung: entwurf.beschreibung.trim() || null }).eq('id', paketId)
        if (error) throw error
        const del = await supabase.from('leistungspaket_positionen').delete().eq('paket_id', paketId)
        if (del.error) throw del.error
        const delStoffe = await supabase.from('leistungspaket_betriebsstoffe').delete().eq('paket_id', paketId)
        if (delStoffe.error) throw delStoffe.error
      } else {
        const { data, error } = await supabase.from('leistungspakete').insert({ betrieb_id: betriebId, name, beschreibung: entwurf.beschreibung.trim() || null }).select('id').single()
        if (error) throw error
        paketId = data.id
      }
      if (pos.length) {
        const { error } = await supabase.from('leistungspaket_positionen').insert(pos.map((p, i) => ({
          paket_id: paketId, betrieb_id: betriebId, art: p.art, beschreibung: p.beschreibung.trim().slice(0, 300),
          menge: zahl(p.menge), einzelpreis: p.einzelpreis.trim() === '' ? null : zahl(p.einzelpreis), sortierung: i,
        })))
        if (error) throw error
      }
      if (stoffe.length) {
        const { error } = await supabase.from('leistungspaket_betriebsstoffe').insert(stoffe.map(s => ({
          paket_id: paketId, betrieb_id: betriebId, betriebsstoff_id: s.betriebsstoff_id, menge: zahl(s.menge),
        })))
        if (error) throw error
      }
      setEntwurf(null)
      router.refresh()
    } catch (e: any) {
      setFehler(e?.message ?? 'Speichern fehlgeschlagen.')
    } finally {
      setSpeichert(false)
    }
  }

  async function loeschen(id: string) {
    const { error } = await supabase.from('leistungspakete').delete().eq('id', id)
    setLoeschenId(null)
    if (error) { alert('Löschen fehlgeschlagen: ' + error.message); return }
    router.refresh()
  }

  const summe = (p: any) =>
    (p.positionen ?? []).reduce((s: number, x: any) => s + Number(x.menge) * Number(x.einzelpreis ?? (x.art === 'arbeit' ? stundensatz ?? 0 : 0)), 0)

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-600">
          Wiederkehrende Arbeiten einmal anlegen — im Auftrag reicht dann ein Klick auf <strong>„Leistungspaket hinzufügen“</strong>.
          Teile landen im Kostenvoranschlag, die Arbeitszeit im Werkstattauftrag (Stundensatz laut Einstellungen{stundensatz != null ? `: ${euro(stundensatz)}` : ' — noch nicht eingetragen'}).
        </p>
        {istAdmin && <Button onClick={neu} className="bg-orange-600 hover:bg-orange-700 text-white flex-shrink-0"><Plus className="w-4 h-4 mr-1.5" />Neues Paket</Button>}
      </div>

      {pakete.length === 0 && !entwurf && (
        <Card><CardContent className="py-12 text-center text-slate-500">
          <PackagePlus className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p>Noch keine Leistungspakete.</p>
          {istAdmin
            ? <p className="text-sm mt-1">Lege eins mit „Neues Paket“ an — oder speichere die Positionen eines vorhandenen Auftrags direkt dort als Paket.</p>
            : <p className="text-sm mt-1">Ein Administrator kann Pakete anlegen.</p>}
        </CardContent></Card>
      )}

      {entwurf && (
        <Card><CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{entwurf.id ? 'Paket bearbeiten' : 'Neues Paket'}</h2>
            <button onClick={() => setEntwurf(null)} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Abbrechen"><X className="w-4 h-4 text-slate-500" /></button>
          </div>
          <input value={entwurf.name} onChange={e => setEntwurf({ ...entwurf, name: e.target.value })} maxLength={120} placeholder="Name, z. B. Ölwechsel mit Filter"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[110px_1fr_80px_110px_32px] gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-1">
              <span>Art</span><span>Beschreibung</span><span>Menge</span><span>Preis netto</span><span />
            </div>
            {entwurf.positionen.map((p, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-[110px_1fr_80px_110px_32px] gap-2 items-center">
                <select value={p.art} onChange={e => setPos(i, { art: e.target.value as 'teil' | 'arbeit' })} className="px-2 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  <option value="teil">Teil</option><option value="arbeit">Arbeit</option>
                </select>
                <input value={p.beschreibung} onChange={e => setPos(i, { beschreibung: e.target.value })} maxLength={300} placeholder={p.art === 'teil' ? 'z. B. Ölfilter' : 'z. B. Ölwechsel durchführen'}
                  className="col-span-2 sm:col-span-1 order-last sm:order-none px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <input value={p.menge} onChange={e => setPos(i, { menge: e.target.value })} inputMode="decimal" placeholder={p.art === 'teil' ? 'Stück' : 'Std.'}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <input value={p.einzelpreis} onChange={e => setPos(i, { einzelpreis: e.target.value })} inputMode="decimal"
                  placeholder={p.art === 'arbeit' ? 'Stundensatz' : '€ je Stück'} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <button onClick={() => setEntwurf({ ...entwurf, positionen: entwurf.positionen.filter((_, k) => k !== i) })} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" aria-label="Position entfernen"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEntwurf({ ...entwurf, positionen: [...entwurf.positionen, { art: 'teil', beschreibung: '', menge: '1', einzelpreis: '' }] })} className="text-sm text-slate-600 hover:text-orange-600 inline-flex items-center gap-1"><Plus className="w-4 h-4" />Teil</button>
              <button onClick={() => setEntwurf({ ...entwurf, positionen: [...entwurf.positionen, { art: 'arbeit', beschreibung: '', menge: '1', einzelpreis: '' }] })} className="text-sm text-slate-600 hover:text-orange-600 inline-flex items-center gap-1"><Plus className="w-4 h-4" />Arbeit</button>
            </div>
            <p className="text-xs text-slate-400">Bei „Arbeit“ den Preis leer lassen: dann gilt immer der aktuelle Stundensatz aus den Einstellungen.</p>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-1 flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5" />Betriebsstoffe (Öl, Kühlmittel …)</p>
            {entwurf.stoffe.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_32px] gap-2 items-center">
                <select value={s.betriebsstoff_id} onChange={e => setEntwurf({ ...entwurf, stoffe: entwurf.stoffe.map((x, k) => (k === i ? { ...x, betriebsstoff_id: e.target.value } : x)) })}
                  className="px-2 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  <option value="">Betriebsstoff wählen …</option>
                  {betriebsstoffe.filter(b => b.aktiv || b.id === s.betriebsstoff_id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <input value={s.menge} onChange={e => setEntwurf({ ...entwurf, stoffe: entwurf.stoffe.map((x, k) => (k === i ? { ...x, menge: e.target.value } : x)) })}
                    inputMode="decimal" placeholder="Menge" className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm" />
                  <span className="text-xs text-slate-500 w-4">{s.betriebsstoff_id ? stoffEinheit(s.betriebsstoff_id) : ''}</span>
                </div>
                <button onClick={() => setEntwurf({ ...entwurf, stoffe: entwurf.stoffe.filter((_, k) => k !== i) })} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" aria-label="Betriebsstoff entfernen"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {betriebsstoffe.length === 0 ? (
              <p className="text-xs text-slate-400">Noch keine Betriebsstoffe angelegt — im Menü unter „Betriebsstoffe“ Öl usw. mit Preis anlegen.</p>
            ) : (
              <button onClick={() => setEntwurf({ ...entwurf, stoffe: [...entwurf.stoffe, { betriebsstoff_id: '', menge: '1' }] })} className="text-sm text-slate-600 hover:text-orange-600 inline-flex items-center gap-1"><Plus className="w-4 h-4" />Betriebsstoff</button>
            )}
            <p className="text-xs text-slate-400">Die Menge wird beim Rechnungschreiben vorbelegt und mit dem aktuellen Preis des Stoffes berechnet.</p>
          </div>
          {fehler && <p className="text-sm text-red-600">{fehler}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEntwurf(null)}>Abbrechen</Button>
            <Button onClick={speichern} disabled={speichert} className="bg-orange-600 hover:bg-orange-700 text-white">{speichert ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {pakete.map(p => (
          <Card key={p.id}><CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{p.name}</p>
                <p className="text-sm text-slate-500">ca. {euro(summe(p))} netto</p>
              </div>
              {istAdmin && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => bearbeiten(p)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="Bearbeiten"><Pencil className="w-4 h-4" /></button>
                  {loeschenId === p.id
                    ? <button onClick={() => loeschen(p.id)} className="px-2 text-xs font-semibold text-white bg-red-600 rounded-lg">Wirklich löschen</button>
                    : <button onClick={() => setLoeschenId(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500" aria-label="Löschen"><Trash2 className="w-4 h-4" /></button>}
                </div>
              )}
            </div>
            <ul className="mt-3 divide-y divide-slate-50 text-sm">
              {[...(p.positionen ?? [])].sort((a: any, b: any) => a.sortierung - b.sortierung).map((x: any) => (
                <li key={x.id} className="flex items-center gap-2 py-1.5">
                  {x.art === 'teil' ? <Package className="w-4 h-4 text-green-600 flex-shrink-0" /> : <Wrench className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                  <span className="flex-1 min-w-0 truncate">{x.beschreibung}</span>
                  <span className="text-slate-500 flex-shrink-0">{Number(x.menge).toLocaleString('de-DE')} {x.art === 'arbeit' ? 'Std.' : '×'}</span>
                  <span className={cn('w-24 text-right flex-shrink-0', x.einzelpreis == null && 'text-slate-400')}>
                    {x.einzelpreis != null ? euro(Number(x.einzelpreis)) : 'Stundensatz'}
                  </span>
                </li>
              ))}
              {(p.betriebsstoffe ?? []).map((b: any) => (
                <li key={b.id} className="flex items-center gap-2 py-1.5">
                  <Droplets className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{stoffName(b.betriebsstoff_id)}</span>
                  <span className="text-slate-500 flex-shrink-0">{Number(b.menge).toLocaleString('de-DE')} {stoffEinheit(b.betriebsstoff_id)}</span>
                  <span className="w-24 text-right flex-shrink-0 text-slate-400">aktueller Preis</span>
                </li>
              ))}
            </ul>
          </CardContent></Card>
        ))}
      </div>
    </div>
  )
}
