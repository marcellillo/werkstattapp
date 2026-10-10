'use client'
// Arbeitszeit am Auftrag: "Arbeit starten/stoppen", Zeit nachtragen, Liste der erfassten Zeiten
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, Loader2, Play, Plus, Square, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRollen } from '@/lib/rollen-context'
import { dauerMinuten, dauerText, istVergessen, stoppEnde, stundenText, uhrText } from '@/lib/arbeitszeit'

interface Eintrag { id: string; user_id: string | null; start_am: string; ende_am: string | null; manuell: boolean; notiz: string | null; auftrag_id: string }

const uhrzeit = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
const tag = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

export function ArbeitszeitKarte({ auftragId, betriebId, gesperrt = false }: { auftragId: string; betriebId: string; gesperrt?: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const { role } = useRollen()
  const darfStempeln = ['admin', 'superadmin', 'mechaniker'].includes(role)
  const istAdmin = ['admin', 'superadmin'].includes(role)
  const [meineId, setMeineId] = useState<string | null>(null)
  const [eintraege, setEintraege] = useState<Eintrag[] | null>(null)
  const [laufende, setLaufende] = useState<(Eintrag & { auftrag?: { auftrag_nr: string | null } | null }) | null>(null)  // meine laufende Zeit (evtl. an anderem Auftrag)
  const [namen, setNamen] = useState<Record<string, string>>({})
  const [jetzt, setJetzt] = useState(Date.now())
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [nachtragen, setNachtragen] = useState(false)
  const [minuten, setMinuten] = useState('')

  const laden = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setMeineId(user?.id ?? null)
    const { data } = await supabase.from('auftrag_zeiten').select('id, user_id, start_am, ende_am, manuell, notiz, auftrag_id')
      .eq('auftrag_id', auftragId).order('start_am', { ascending: false }).limit(200)
    setEintraege((data ?? []) as Eintrag[])
    const ids = [...new Set((data ?? []).map((e: any) => e.user_id).filter(Boolean))] as string[]
    if (ids.length) {
      const { data: profile } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      setNamen(Object.fromEntries((profile ?? []).map((p: any) => [p.id, p.full_name || 'Mitarbeiter'])))
    }
    if (user) {
      const { data: l } = await supabase.from('auftrag_zeiten').select('id, user_id, start_am, ende_am, manuell, notiz, auftrag_id, auftrag:auftraege(auftrag_nr)')
        .eq('betrieb_id', betriebId).eq('user_id', user.id).is('ende_am', null).maybeSingle()
      setLaufende((l as any) ?? null)
    }
  }, [supabase, auftragId, betriebId])

  useEffect(() => { laden() }, [laden])
  useEffect(() => {
    if (!laufende) return
    const t = setInterval(() => setJetzt(Date.now()), 1000)
    return () => clearInterval(t)
  }, [laufende])

  async function stoppen(z: Eintrag) {
    const { ende, notiz } = stoppEnde(z)
    const { error } = await supabase.from('auftrag_zeiten').update({ ende_am: ende, ...(notiz ? { notiz } : {}) }).eq('id', z.id)
    if (error) throw error
  }

  async function starten() {
    if (!meineId) return
    setArbeitet(true); setFehler(null)
    try {
      if (laufende) await stoppen(laufende)   // eine laufende Zeit an einem anderen Auftrag wird dabei beendet
      const { error } = await supabase.from('auftrag_zeiten').insert({ betrieb_id: betriebId, auftrag_id: auftragId, user_id: meineId })
      if (error) throw error
      await laden()
    } catch (e: any) {
      setFehler(e?.message?.includes('duplicate') ? 'Es läuft bereits eine Zeit — Seite neu laden.' : (e?.message ?? 'Konnte nicht gestartet werden.'))
    } finally { setArbeitet(false) }
  }

  async function stoppenKlick() {
    if (!laufende) return
    setArbeitet(true); setFehler(null)
    try { await stoppen(laufende); await laden() } catch (e: any) { setFehler(e?.message ?? 'Konnte nicht gestoppt werden.') } finally { setArbeitet(false) }
  }

  async function nachtragenSpeichern() {
    const m = Math.round(Number(minuten.replace(',', '.')))
    if (!meineId || !(m > 0 && m <= 24 * 60)) { setFehler('Bitte die Minuten eintragen (1 bis 1440).'); return }
    setArbeitet(true); setFehler(null)
    try {
      const ende = new Date(); const start = new Date(ende.getTime() - m * 60_000)
      const { error } = await supabase.from('auftrag_zeiten').insert({ betrieb_id: betriebId, auftrag_id: auftragId, user_id: meineId, start_am: start.toISOString(), ende_am: ende.toISOString(), manuell: true })
      if (error) throw error
      setMinuten(''); setNachtragen(false); await laden()
    } catch (e: any) { setFehler(e?.message ?? 'Konnte nicht gespeichert werden.') } finally { setArbeitet(false) }
  }

  async function loeschen(id: string) {
    const { error } = await supabase.from('auftrag_zeiten').delete().eq('id', id)
    if (error) { setFehler(error.message); return }
    await laden()
  }

  if (eintraege === null) return null
  const hierLaeuft = laufende && laufende.auftrag_id === auftragId ? laufende : null
  const woanders = laufende && laufende.auftrag_id !== auftragId ? laufende : null
  const summe = eintraege.reduce((s, e) => s + dauerMinuten(e, jetzt), 0)
  if (!darfStempeln && eintraege.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" id="arbeitszeit">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100">
        <Clock className="w-4 h-4 text-orange-500" />
        <span className="font-semibold text-sm text-slate-800">Arbeitszeit</span>
        <span className="ml-auto text-sm text-slate-600">{eintraege.length > 0 ? <>insgesamt <strong className="text-slate-900">{dauerText(summe)}</strong> ({stundenText(summe)} h)</> : 'noch nichts erfasst'}</span>
      </div>

      {darfStempeln && !gesperrt && (
        <div className="px-4 py-3 space-y-2">
          {hierLaeuft ? (
            <button onClick={stoppenKlick} disabled={arbeitet} className="w-full flex items-center justify-center gap-3 rounded-xl bg-red-600 hover:bg-red-700 text-white py-3 font-semibold disabled:opacity-60">
              {arbeitet ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5 fill-current" />}
              Stoppen <span className="font-mono tabular-nums text-red-100">{uhrText(hierLaeuft.start_am, jetzt)}</span>
            </button>
          ) : (
            <button onClick={starten} disabled={arbeitet} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 font-semibold disabled:opacity-60">
              {arbeitet ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />} Arbeit starten
            </button>
          )}
          {hierLaeuft && istVergessen(hierLaeuft, jetzt) && <p className="text-xs text-amber-700">Diese Zeit läuft schon sehr lange — beim Stoppen wird sie auf 8 Stunden begrenzt (bitte prüfen).</p>}
          {woanders && <p className="text-xs text-slate-500">Du hast noch eine Zeit bei Auftrag {woanders.auftrag?.auftrag_nr ?? ''} laufen — „Arbeit starten“ beendet sie.</p>}
          {nachtragen ? (
            <div className="flex items-center gap-2">
              <input value={minuten} onChange={e => setMinuten(e.target.value)} inputMode="numeric" placeholder="Minuten (z. B. 45)" aria-label="Minuten nachtragen"
                className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <button onClick={nachtragenSpeichern} disabled={arbeitet} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-50">Eintragen</button>
              <button onClick={() => { setNachtragen(false); setFehler(null) }} className="px-2 py-2 text-sm text-slate-500">Abbrechen</button>
            </div>
          ) : (
            <button onClick={() => setNachtragen(true)} className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Zeit nachtragen (bis jetzt gearbeitet)</button>
          )}
          {fehler && <p className="text-xs text-red-600">{fehler}</p>}
        </div>
      )}

      {eintraege.length > 0 && (
        <ul className="divide-y divide-slate-50 border-t border-slate-100">
          {eintraege.map(e => {
            const mein = e.user_id === meineId
            return (
              <li key={e.id} className="px-4 py-2 flex items-center gap-2 text-sm">
                <span className="text-slate-500 w-12 flex-shrink-0">{tag(e.start_am)}</span>
                <span className="flex-1 min-w-0 truncate text-slate-700">
                  {e.user_id ? (namen[e.user_id] ?? 'Mitarbeiter') : 'Unbekannt'}
                  <span className="text-xs text-slate-400"> · {e.manuell ? 'nachgetragen' : `${uhrzeit(e.start_am)}–${e.ende_am ? uhrzeit(e.ende_am) : 'läuft'}`}</span>
                  {e.notiz && <span className="block text-xs text-amber-700 truncate" title={e.notiz}>⚠ {e.notiz}</span>}
                </span>
                <span className="font-medium text-slate-900 flex-shrink-0">{e.ende_am ? dauerText(dauerMinuten(e)) : 'läuft'}</span>
                {(mein || istAdmin) && e.ende_am && (
                  <button onClick={() => loeschen(e.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500" aria-label="Zeit löschen"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
