'use client'
// Fehlende Einkaufs-/Verkaufspreise der Eigenfahrzeuge schnell nachtragen (Liste, je Zeile ein Speichern).
// Ohne Einkaufspreis kann die App weder Marge noch Gewinn rechnen.
import { useMemo, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { preisAusText } from '@/lib/standzeit'

export interface PreisZeile { id: string; name: string; kennzeichen: string | null; mobileId: string | null; einkauf: number | null; verkauf: number | null }

const text = (n: number | null) => (n ? String(n).replace('.', ',') : '')

export function PreiseNachtragen({ zeilen, onClose, onGespeichert }: { zeilen: PreisZeile[]; onClose: () => void; onGespeichert: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [werte, setWerte] = useState<Record<string, { ek: string; vk: string }>>(() => Object.fromEntries(zeilen.map(z => [z.id, { ek: text(z.einkauf), vk: text(z.verkauf) }])))
  const [status, setStatus] = useState<Record<string, 'speichert' | 'ok' | string>>({})
  const [nurOffene, setNurOffene] = useState(true)
  const [geaendert, setGeaendert] = useState(false)

  const sichtbar = zeilen.filter(z => !nurOffene || status[z.id] === 'ok' || !z.einkauf || !z.verkauf)

  async function speichern(z: PreisZeile) {
    const w = werte[z.id]
    const ek = w.ek.trim() === '' ? null : preisAusText(w.ek)
    const vk = w.vk.trim() === '' ? null : preisAusText(w.vk)
    if ((w.ek.trim() !== '' && ek === null) || (w.vk.trim() !== '' && vk === null)) { setStatus(s => ({ ...s, [z.id]: 'Zahl nicht lesbar' })); return }
    setStatus(s => ({ ...s, [z.id]: 'speichert' }))
    const patch: Record<string, number> = {}
    if (ek !== null) patch.einkaufspreis = ek
    if (vk !== null) patch.verkaufspreis = vk
    if (Object.keys(patch).length === 0) { setStatus(s => ({ ...s, [z.id]: 'Bitte einen Preis eintragen' })); return }
    const { error } = await supabase.from('fahrzeuge').update(patch).eq('id', z.id)
    if (error) { setStatus(s => ({ ...s, [z.id]: 'Fehler beim Speichern' })); return }
    setStatus(s => ({ ...s, [z.id]: 'ok' }))
    setGeaendert(true)
  }

  const eingabe = (z: PreisZeile, feld: 'ek' | 'vk', platz: string) => (
    <input
      value={werte[z.id][feld]} inputMode="decimal" placeholder={platz} aria-label={`${feld === 'ek' ? 'Einkaufspreis' : 'Verkaufspreis'} ${z.name}`}
      onChange={e => { setWerte(v => ({ ...v, [z.id]: { ...v[z.id], [feld]: e.target.value } })); setStatus(s => { const n = { ...s }; delete n[z.id]; return n }) }}
      onKeyDown={e => { if (e.key === 'Enter') speichern(z) }}
      className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-purple-400"
    />
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => { if (geaendert) onGespeichert(); onClose() }}>
      <div className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} role="dialog" aria-label="Preise nachtragen">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900">Preise nachtragen</p>
            <p className="text-xs text-gray-500">Einkauf und Verkauf (brutto) — damit Marge und Gewinn stimmen</p>
          </div>
          <button onClick={() => { if (geaendert) onGespeichert(); onClose() }} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Schließen"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <label className="px-5 py-2 text-xs text-gray-600 flex items-center gap-2 border-b border-gray-50">
          <input type="checkbox" checked={nurOffene} onChange={e => setNurOffene(e.target.checked)} className="accent-purple-600" /> Nur Fahrzeuge mit fehlendem Preis
        </label>
        <div className="overflow-y-auto divide-y divide-gray-50">
          {sichtbar.length === 0 && <p className="px-5 py-8 text-center text-sm text-gray-500">Bei allen Fahrzeugen sind Einkaufs- und Verkaufspreis eingetragen. 🎉</p>}
          {sichtbar.map(z => {
            const st = status[z.id]
            return (
              <div key={z.id} className="px-5 py-3">
                <p className="text-sm font-medium text-gray-900 truncate">{z.name}</p>
                <p className="text-xs text-gray-400 font-mono">{[z.mobileId, z.kennzeichen].filter(Boolean).join(' · ') || '—'}</p>
                <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div><span className="text-[10px] text-blue-600">Einkauf €</span>{eingabe(z, 'ek', '0')}</div>
                  <div><span className="text-[10px] text-purple-600">Verkauf €</span>{eingabe(z, 'vk', '0')}</div>
                  <button onClick={() => speichern(z)} disabled={st === 'speichert'}
                    className={`h-[38px] px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 ${st === 'ok' ? 'bg-green-100 text-green-700' : 'bg-purple-600 hover:bg-purple-700 text-white'} disabled:opacity-60`}>
                    {st === 'speichert' ? <Loader2 className="w-4 h-4 animate-spin" /> : st === 'ok' ? <><Check className="w-4 h-4" /> Gespeichert</> : 'Speichern'}
                  </button>
                </div>
                {st && st !== 'ok' && st !== 'speichert' && <p className="text-xs text-red-600 mt-1">{st}</p>}
              </div>
            )
          })}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 text-right">
          <button onClick={() => { if (geaendert) onGespeichert(); onClose() }} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium">Fertig</button>
        </div>
      </div>
    </div>
  )
}
