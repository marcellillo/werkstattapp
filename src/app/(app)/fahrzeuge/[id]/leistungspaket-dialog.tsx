'use client'
// Leistungspaket in den Auftrag übernehmen (Teile -> Kostenvoranschlag, Arbeitszeit -> Werkstattauftrag)
// bzw. (Admins) die vorhandenen Positionen des Auftrags als neues Paket speichern.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, PackagePlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRollen } from '@/lib/rollen-context'

interface Props {
  auftragId: string
  betriebId: string
  onClose: () => void
  /** nach erfolgreichem Übernehmen: Kostenvoranschlag/Werkstattauftrag neu laden */
  onUebernommen: () => void
}

const euro = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export function LeistungspaketDialog({ auftragId, betriebId, onClose, onUebernommen }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const { kannZugreifen } = useRollen()
  const istAdmin = kannZugreifen('einstellungen')
  const [pakete, setPakete] = useState<any[] | null>(null)
  const [stundensatz, setStundensatz] = useState<number | null>(null)
  const [arbeitetId, setArbeitetId] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<{ text: string; hinweise: string[] } | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [neuerName, setNeuerName] = useState('')
  const [speichert, setSpeichert] = useState(false)

  async function laden() {
    const [p, c] = await Promise.all([
      supabase.from('leistungspakete')
        .select('id, name, beschreibung, positionen:leistungspaket_positionen(art, beschreibung, menge, einzelpreis, sortierung), betriebsstoffe:leistungspaket_betriebsstoffe(menge, stoff:betriebsstoffe(name, einheit))')
        .eq('betrieb_id', betriebId).order('name'),
      supabase.from('betrieb_einstellungen').select('wert').eq('betrieb_id', betriebId).eq('schluessel', 'firma_stundensatz').maybeSingle(),
    ])
    setPakete(p.data ?? [])
    const satz = parseFloat(String(c.data?.wert ?? '').replace(',', '.'))
    setStundensatz(Number.isFinite(satz) ? satz : null)
  }
  useEffect(() => { laden() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  function zusammenfassung(p: any) {
    const teile = (p.positionen ?? []).filter((x: any) => x.art === 'teil')
    const arbeit = (p.positionen ?? []).filter((x: any) => x.art === 'arbeit')
    const stunden = arbeit.reduce((s: number, x: any) => s + Number(x.menge), 0)
    const summe =
      teile.reduce((s: number, x: any) => s + Number(x.menge) * Number(x.einzelpreis ?? 0), 0) +
      arbeit.reduce((s: number, x: any) => s + Number(x.menge) * Number(x.einzelpreis ?? stundensatz ?? 0), 0)
    const teileText = teile.length ? `${teile.length} Teil${teile.length > 1 ? 'e' : ''}` : ''
    const arbeitText = arbeit.length ? `${stunden.toLocaleString('de-DE', { maximumFractionDigits: 2 })} Std. Arbeit` : ''
    const stoffText = (p.betriebsstoffe ?? []).map((b: any) => `${Number(b.menge).toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${b.stoff?.einheit ?? 'L'} ${b.stoff?.name ?? ''}`.trim()).join(', ')
    return { text: [teileText, arbeitText, stoffText].filter(Boolean).join(' · '), summe }
  }

  async function uebernehmen(p: any) {
    setFehler(null); setArbeitetId(p.id)
    try {
      const res = await fetch('/api/leistungspaket/anwenden', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auftragId, paketId: p.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Das Paket konnte nicht übernommen werden.')
      setErgebnis({
        text: `„${d.paket}“ wurde übernommen${d.teile ? ` — ${d.teile} Teil${d.teile > 1 ? 'e im Kostenvoranschlag' : ' im Kostenvoranschlag'}` : ''}${d.arbeiten ? `${d.teile ? ',' : ' —'} ${d.arbeiten} Arbeitsposition${d.arbeiten > 1 ? 'en' : ''} im Werkstattauftrag` : ''}${d.betriebsstoffe ? `${d.teile || d.arbeiten ? ',' : ' —'} ${d.betriebsstoffe} Betriebsstoff${d.betriebsstoffe > 1 ? 'e' : ''} (wird beim Rechnungschreiben vorbelegt)` : ''}.`,
        hinweise: d.hinweise ?? [],
      })
      onUebernommen()
    } catch (e: any) {
      setFehler(e?.message ?? 'Das Paket konnte nicht übernommen werden.')
    } finally {
      setArbeitetId(null)
    }
  }

  async function alsPaketSpeichern() {
    if (!neuerName.trim()) return
    setFehler(null); setSpeichert(true)
    try {
      const res = await fetch('/api/leistungspaket/aus-auftrag', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auftragId, name: neuerName.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Das Paket konnte nicht gespeichert werden.')
      setNeuerName('')
      setErgebnis({ text: `Paket gespeichert (${d.teile} Teil${d.teile === 1 ? '' : 'e'}, ${d.arbeiten} Arbeitsposition${d.arbeiten === 1 ? '' : 'en'}). Es steht ab sofort bei jedem Auftrag zur Verfügung.`, hinweise: [] })
      await laden()
    } catch (e: any) {
      setFehler(e?.message ?? 'Das Paket konnte nicht gespeichert werden.')
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()} role="dialog" aria-label="Leistungspaket hinzufügen">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 font-semibold text-slate-900"><PackagePlus className="w-5 h-5 text-orange-500" /> Leistungspaket hinzufügen</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Schließen"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {ergebnis && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
              <p className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" />{ergebnis.text}</p>
              {ergebnis.hinweise.map((h, i) => <p key={i} className="mt-1 text-amber-800">⚠ {h}</p>)}
            </div>
          )}
          {fehler && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{fehler}</p>}

          {pakete === null ? (
            <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Pakete werden geladen …</p>
          ) : pakete.length === 0 ? (
            <p className="text-sm text-slate-600">
              Noch keine Pakete angelegt. {istAdmin
                ? 'Erfasse bei einem Auftrag Teile (Kostenvoranschlag) und Arbeitszeit (Werkstattauftrag) und speichere sie unten als Paket — oder lege Pakete unter „Weitere Funktionen → Leistungspakete“ an.'
                : 'Ein Administrator kann Pakete unter „Weitere Funktionen → Leistungspakete“ anlegen.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {pakete.map(p => {
                const z = zusammenfassung(p)
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => uebernehmen(p)}
                      disabled={arbeitetId !== null}
                      className="w-full text-left rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 disabled:opacity-60 px-4 py-3 transition-colors flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{p.name}</p>
                        <p className="text-xs text-slate-500">{z.text}{z.summe > 0 ? ` · ca. ${euro(z.summe)} netto` : ''}</p>
                      </div>
                      {arbeitetId === p.id ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> : <span className="text-xs font-semibold text-orange-600">Hinzufügen</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {istAdmin && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Neues Paket aus diesem Auftrag</p>
              <p className="text-xs text-slate-500">Übernimmt die Teile aus dem offenen Kostenvoranschlag und die Arbeitszeit aus dem offenen Werkstattauftrag dieses Auftrags.</p>
              <div className="flex gap-2">
                <input
                  value={neuerName} onChange={e => setNeuerName(e.target.value)} maxLength={120}
                  placeholder="Name, z. B. Ölwechsel mit Filter"
                  className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button onClick={alsPaketSpeichern} disabled={speichert || !neuerName.trim()} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-40">
                  {speichert ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
          {istAdmin ? <Link href="/leistungspakete" className="text-sm text-slate-500 hover:text-slate-800 underline underline-offset-2">Pakete verwalten</Link> : <span />}
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">{ergebnis ? 'Fertig' : 'Schließen'}</button>
        </div>
      </div>
    </div>
  )
}
