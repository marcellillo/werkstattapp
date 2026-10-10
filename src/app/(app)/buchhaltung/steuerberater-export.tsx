'use client'
// Paket für den Steuerberater (ZIP mit CSV-Listen, auf Wunsch Rechnungs-PDFs und Eingangsbelege)
import { useState } from 'react'
import { Download, FileArchive, Loader2, X } from 'lucide-react'
import { plusTage, tagBerlin } from '@/lib/zahlung'

type Vorgabe = 'letzter-monat' | 'dieser-monat' | 'letztes-quartal' | 'dieses-quartal' | 'dieses-jahr' | 'letztes-jahr' | 'eigen'

const VORGABEN: { wert: Vorgabe; label: string }[] = [
  { wert: 'letzter-monat', label: 'Letzter Monat' },
  { wert: 'dieser-monat', label: 'Dieser Monat' },
  { wert: 'letztes-quartal', label: 'Letztes Quartal' },
  { wert: 'dieses-quartal', label: 'Dieses Quartal' },
  { wert: 'dieses-jahr', label: 'Dieses Jahr' },
  { wert: 'letztes-jahr', label: 'Letztes Jahr' },
  { wert: 'eigen', label: 'Eigener Zeitraum …' },
]

const letzterTag = (j: number, m: number) => new Date(Date.UTC(j, m, 0)).toISOString().slice(0, 10) // m = 1..12
const zweistellig = (n: number) => String(n).padStart(2, '0')

function bereich(v: Vorgabe, heute: string): { von: string; bis: string } {
  const j = Number(heute.slice(0, 4)), m = Number(heute.slice(5, 7))
  const quartalStart = Math.floor((m - 1) / 3) * 3 + 1
  switch (v) {
    case 'dieser-monat': return { von: `${j}-${zweistellig(m)}-01`, bis: letzterTag(j, m) }
    case 'letzter-monat': { const jj = m === 1 ? j - 1 : j, mm = m === 1 ? 12 : m - 1; return { von: `${jj}-${zweistellig(mm)}-01`, bis: letzterTag(jj, mm) } }
    case 'dieses-quartal': return { von: `${j}-${zweistellig(quartalStart)}-01`, bis: letzterTag(j, quartalStart + 2) }
    case 'letztes-quartal': { const q = quartalStart - 3, jj = q < 1 ? j - 1 : j, qq = q < 1 ? q + 12 : q; return { von: `${jj}-${zweistellig(qq)}-01`, bis: letzterTag(jj, qq + 2) } }
    case 'dieses-jahr': return { von: `${j}-01-01`, bis: `${j}-12-31` }
    case 'letztes-jahr': return { von: `${j - 1}-01-01`, bis: `${j - 1}-12-31` }
    default: return { von: plusTage(heute, -30), bis: heute }
  }
}

const euro = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const datumDE = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`

export function SteuerberaterExport({ onClose }: { onClose: () => void }) {
  const heute = tagBerlin()
  const [vorgabe, setVorgabe] = useState<Vorgabe>('letzter-monat')
  const [eigen, setEigen] = useState(() => bereich('eigen', heute))
  const [pdfs, setPdfs] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<any>(null)

  const zeitraum = vorgabe === 'eigen' ? eigen : bereich(vorgabe, heute)

  async function erstellen() {
    setLaeuft(true); setFehler(null); setErgebnis(null)
    try {
      const res = await fetch('/api/buchhaltung/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ von: zeitraum.von, bis: zeitraum.bis, pdfs }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Das Paket konnte nicht erstellt werden.')
      setErgebnis(d)
    } catch (e: any) {
      setFehler(e?.message ?? 'Das Paket konnte nicht erstellt werden.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} role="dialog" aria-label="Export für den Steuerberater">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 font-semibold text-slate-900"><FileArchive className="w-5 h-5 text-orange-500" /> Export für den Steuerberater</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Schließen"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-slate-600">Ein ZIP mit Listen (Excel) der Kundenrechnungen, Lieferantenrechnungen und Fahrzeugverkäufe — dazu alle Eingangsbelege.</p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 block">Zeitraum</label>
            <select value={vorgabe} onChange={e => { setVorgabe(e.target.value as Vorgabe); setErgebnis(null) }} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
              {VORGABEN.map(v => <option key={v.wert} value={v.wert}>{v.label}</option>)}
            </select>
            {vorgabe === 'eigen' ? (
              <div className="flex items-center gap-2">
                <input type="date" value={eigen.von} onChange={e => setEigen(z => ({ ...z, von: e.target.value }))} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" aria-label="Von" />
                <span className="text-slate-400">–</span>
                <input type="date" value={eigen.bis} onChange={e => setEigen(z => ({ ...z, bis: e.target.value }))} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" aria-label="Bis" />
              </div>
            ) : (
              <p className="text-xs text-slate-500">{datumDE(zeitraum.von)} bis {datumDE(zeitraum.bis)}</p>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={pdfs} onChange={e => setPdfs(e.target.checked)} className="mt-0.5 accent-orange-500" />
            <span>Rechnungen als PDF beilegen <span className="text-slate-400">(bis 20 Stück, dauert etwas länger)</span></span>
          </label>

          {fehler && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fehler}</p>}

          {ergebnis && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 space-y-1">
              <p>Kundenrechnungen: <strong>{ergebnis.ausgang.anzahl}</strong>{ergebnis.ausgang.storniert ? ` (+ ${ergebnis.ausgang.storniert} storniert)` : ''} · netto {euro(ergebnis.ausgang.netto)} · brutto {euro(ergebnis.ausgang.brutto)}</p>
              <p>Lieferantenrechnungen: <strong>{ergebnis.eingang.anzahl}</strong> · {euro(ergebnis.eingang.summe)} · {ergebnis.eingang.belege} Belege beigelegt</p>
              <p>Fahrzeugverkäufe: <strong>{ergebnis.fahrzeugverkaeufe}</strong>{pdfs ? ` · ${ergebnis.pdfs} Rechnungs-PDFs` : ''}</p>
              {(ergebnis.hinweise ?? []).map((h: string, i: number) => <p key={i} className="text-amber-800">⚠ {h}</p>)}
              <a href={ergebnis.downloadUrl} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2">
                <Download className="w-4 h-4" /> {ergebnis.dateiname} ({(ergebnis.groesse / 1024).toLocaleString('de-DE', { maximumFractionDigits: 0 })} KB)
              </a>
              <p className="text-xs text-emerald-800">Der Link gilt 10 Minuten.</p>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Schließen</button>
          <button onClick={erstellen} disabled={laeuft || !zeitraum.von || !zeitraum.bis || zeitraum.bis < zeitraum.von}
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2">
            {laeuft ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird erstellt …</> : ergebnis ? 'Neu erstellen' : 'Paket erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}
