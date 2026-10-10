'use client'
// Vorgangs-Leiste: zeigt, wo der Auftrag gerade steht (Angenommen → Kostenvoranschlag → Arbeit → Fertig →
// Rechnung → Übergeben) und bietet GENAU EINEN nächsten Schritt als großen Button an. Die Schritte benutzen
// dieselben Abläufe wie bisher (Statuswechsel mit Bühnen-Hinweis/Checkliste, Kostenvoranschlag anlegen,
// Rechnungs-Assistent) — es kommt nichts Neues dazu, nur der Weg ist sichtbar und kürzer.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Camera, Check, ChevronRight, Loader2, FolderOpen, PackagePlus, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { FahrzeugStatus } from '@/types/database'
import { LeistungspaketDialog } from './leistungspaket-dialog'
import { FreigabeDialog } from './freigabe-dialog'
import { useBetrieb } from '@/lib/betrieb-context'

interface Props {
  auftragId: string
  fahrzeugId?: string
  betriebId: string
  status: FahrzeugStatus
  istEigenfahrzeug: boolean
  /** erhöht sich, wenn sich Kostenvoranschläge/Rechnungen geändert haben */
  aktualisierung: number
  onStatus: (s: FahrzeugStatus) => void
  onVerkaufen: () => void
  onKostenvoranschlagErstellt: () => void
  /** nach Übernahme eines Leistungspakets: Kostenvoranschlag/Werkstattauftrag neu laden */
  onPaketUebernommen: () => void
  kunde?: any
  fahrzeugName?: string
  /** Schnell-Annahme (km, Tank, Fotos, Unterschrift): Zustand der Erfassung + Knopf zum Öffnen */
  annahme?: { erfasst: boolean; text: string }
  onAnnahme?: () => void
}

type SchrittZustand = 'erledigt' | 'aktuell' | 'offen'
interface Schritt { key: string; label: string }

const SCHRITTE_FREMD: Schritt[] = [
  { key: 'angenommen', label: 'Angenommen' },
  { key: 'angebot', label: 'Kosten\u00advoranschlag' },
  { key: 'arbeit', label: 'In Arbeit' },
  { key: 'rechnung', label: 'Rechnung' },
  { key: 'fertig', label: 'Fertig' },
  { key: 'uebergeben', label: 'Übergeben' },
]
const SCHRITTE_EIGEN: Schritt[] = [
  { key: 'bestand', label: 'Im Bestand' },
  { key: 'bereit', label: 'Verkaufs\u00adbereit' },
  { key: 'verkauft', label: 'Verkauft' },
  { key: 'uebergeben', label: 'Übergeben' },
]

const euro = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export function VorgangLeiste({ auftragId, fahrzeugId, betriebId, status, istEigenfahrzeug, aktualisierung, onStatus, onVerkaufen, onKostenvoranschlagErstellt, onPaketUebernommen, kunde, fahrzeugName = '', annahme, onAnnahme }: Props) {
  const { currentBetrieb } = useBetrieb()
  const supabase = useMemo(() => createClient(), [])
  const [kva, setKva] = useState<{ anzahl: number; offen: number }>({ anzahl: 0, offen: 0 })
  const [wa, setWa] = useState<{ anzahl: number; offen: number }>({ anzahl: 0, offen: 0 })
  const [rechnungen, setRechnungen] = useState<{ nr: string; status: string; brutto: number }[]>([])
  const [geladen, setGeladen] = useState(false)
  const [erstellt, setErstellt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [paketOffen, setPaketOffen] = useState(false)
  const [freigabeOffen, setFreigabeOffen] = useState(false)
  const [kvaOffen, setKvaOffen] = useState<any | null>(null)   // neuester noch nicht abgerechneter Kostenvoranschlag
  useEffect(() => {
    const neu = () => setTick(t => t + 1)
    window.addEventListener('focus', neu)
    return () => window.removeEventListener('focus', neu)
  }, [])

  useEffect(() => {
    let aktiv = true
    ;(async () => {
      const [k, w, r] = await Promise.all([
        supabase.from('kostenvoranschlaege').select('id, rechnung_id, status, freigabe_gesendet_am, freigegeben_am, freigegeben_name, freigegeben_betrag, freigabe_hinweis, created_at').eq('betrieb_id', betriebId).eq('auftrag_id', auftragId).order('created_at', { ascending: false }),
        supabase.from('werkstattauftraege').select('id, rechnung_id').eq('betrieb_id', betriebId).eq('auftrag_id', auftragId),
        supabase.from('kunden_rechnungen').select('rechnungs_nr, status, betrag_brutto').eq('betrieb_id', betriebId).eq('auftrag_id', auftragId).order('erstellt_am'),
      ])
      if (!aktiv) return
      setKva({ anzahl: k.data?.length ?? 0, offen: (k.data ?? []).filter(x => !x.rechnung_id).length })
      setKvaOffen((k.data ?? []).find(x => !x.rechnung_id) ?? null)
      setWa({ anzahl: w.data?.length ?? 0, offen: (w.data ?? []).filter(x => !x.rechnung_id).length })
      setRechnungen((r.data ?? []).filter(x => x.status !== 'storniert').map(x => ({ nr: x.rechnungs_nr, status: x.status, brutto: Number(x.betrag_brutto) || 0 })))
      setGeladen(true)
    })()
    return () => { aktiv = false }
  }, [supabase, auftragId, betriebId, aktualisierung, tick])

  if (status === ('storniert' as FahrzeugStatus)) return null

  const arbeitBegonnen = ['reparatur', 'warten_teile', 'fertig', 'ausgeliefert'].includes(status)
  const fertig = ['fertig', 'ausgeliefert', 'verkauft'].includes(status)
  const uebergeben = status === 'ausgeliefert'
  const verkauft = status === 'verkauft' || status === 'ausgeliefert'
  const hatRechnung = rechnungen.length > 0

  // ── erledigt-Flags je Schritt ──
  const erledigt: Record<string, boolean> = istEigenfahrzeug
    ? { bestand: true, bereit: fertig, verkauft, uebergeben }
    : {
        angenommen: true,
        angebot: kva.anzahl > 0 || arbeitBegonnen,
        arbeit: arbeitBegonnen,
        fertig,
        rechnung: hatRechnung,
        uebergeben,
      }
  const schritte = istEigenfahrzeug ? SCHRITTE_EIGEN : SCHRITTE_FREMD
  const aktuellerKey = schritte.find(s => !erledigt[s.key])?.key ?? null
  const zustand = (s: Schritt): SchrittZustand => (erledigt[s.key] ? 'erledigt' : s.key === aktuellerKey ? 'aktuell' : 'offen')

  async function kostenvoranschlagErstellen() {
    setFehler(null)
    setErstellt(true)
    try {
      const res = await fetch('/api/kostenvoranschlag/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auftragId, betriebId, fahrzeugId, typ: 'werkstatt' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kostenvoranschlag konnte nicht erstellt werden')
      onKostenvoranschlagErstellt()
      setTimeout(() => document.getElementById('vorgang-dokumente')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    } catch (e: any) {
      setFehler(e?.message ?? 'Kostenvoranschlag konnte nicht erstellt werden')
    } finally {
      setErstellt(false)
    }
  }

  const freigabeText = (() => {
    if (!kvaOffen || kvaOffen.status !== 'akzeptiert') return ''
    const teile = [
      kvaOffen.freigegeben_name,
      kvaOffen.freigegeben_am && new Date(kvaOffen.freigegeben_am).toLocaleDateString('de-DE'),
      kvaOffen.freigegeben_betrag != null && euro(Number(kvaOffen.freigegeben_betrag)),
    ].filter(Boolean)
    return 'Vom Kunden freigegeben' + (teile.length ? ` (${teile.join(', ')})` : '')
  })()

  // ── nächster Schritt: Text + Aktion ──
  type Aktion =
    | { art: 'knopf'; text: string; hinweis?: string; los: () => void; busy?: boolean; zweit?: { text: string; los: () => void } }
    | { art: 'link'; text: string; hinweis?: string; href: string; zweit?: { text: string; los: () => void } }
    | { art: 'fertig'; hinweis: string }

  let aktion: Aktion
  if (!geladen) {
    aktion = { art: 'fertig', hinweis: 'Wird geladen …' }
  } else if (istEigenfahrzeug) {
    if (aktuellerKey === 'bereit') aktion = { art: 'knopf', text: 'Als verkaufsbereit melden', hinweis: 'Aufbereitung abgeschlossen — Checkliste wird abgefragt.', los: () => onStatus('fertig') }
    else if (aktuellerKey === 'verkauft') aktion = { art: 'knopf', text: 'Als verkauft markieren', hinweis: 'Verkaufspreis und Käufer werden im nächsten Schritt erfasst.', los: onVerkaufen }
    else if (aktuellerKey === 'uebergeben') aktion = { art: 'knopf', text: 'Fahrzeug übergeben', hinweis: 'Schließt den Vorgang ab (Archiv „Übergeben“).', los: () => onStatus('ausgeliefert') }
    else aktion = { art: 'fertig', hinweis: 'Vorgang abgeschlossen — Mappe und Unterlagen bleiben im Archiv erhalten.' }
  } else {
    switch (aktuellerKey) {
      case 'angebot':
        aktion = {
          art: 'knopf', text: 'Kostenvoranschlag erstellen', busy: erstellt,
          hinweis: 'Teile und Preise erfassen — später wird alles automatisch in die Rechnung übernommen.',
          los: kostenvoranschlagErstellen,
          zweit: { text: 'Ohne Voranschlag direkt in Arbeit', los: () => onStatus('reparatur') },
        }
        break
      case 'arbeit':
        aktion = { art: 'knopf', text: 'Arbeit starten', hinweis: 'Setzt den Status auf „In Arbeit“ (Hebebühne wird bei Bedarf abgefragt).', los: () => onStatus('reparatur') }
        break
      case 'fertig':
        aktion = { art: 'knopf', text: 'Fertig melden', hinweis: 'Kurze Checkliste, danach kann der Kunde benachrichtigt werden („Fahrzeug ist abholbereit“).', los: () => onStatus('fertig') }
        break
      case 'rechnung': {
        const offen = kva.offen + wa.offen
        aktion = {
          art: 'link', text: 'Rechnung erstellen', href: `/fahrzeuge/${auftragId}/rechnung`,
          hinweis: offen > 0
            ? `${offen} Kostenvoranschlag/Werkstattauftrag werden automatisch übernommen — Positionen nur noch prüfen.`
            : 'Positionen im Rechnungs-Assistenten auswählen.',
          zweit: status === 'fertig'
            ? { text: 'Ohne Rechnung übergeben', los: () => onStatus('ausgeliefert') }
            : { text: 'Ohne Rechnung fertig melden', los: () => onStatus('fertig') },
        }
        break
      }
      case 'uebergeben': {
        const offenR = rechnungen.filter(r => r.status === 'offen')
        aktion = {
          art: 'knopf', text: 'Fahrzeug übergeben',
          hinweis: offenR.length ? `Rechnung ${offenR[0].nr} (${euro(offenR[0].brutto)}) ist noch offen — Zahlung in der Buchhaltung eintragen.` : 'Alles abgerechnet.',
          los: () => onStatus('ausgeliefert'),
        }
        break
      }
      default:
        aktion = { art: 'fertig', hinweis: 'Vorgang abgeschlossen — Mappe und Unterlagen bleiben im Archiv erhalten.' }
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm" aria-label="Vorgang">
      {/* Schritte */}
      <ol className="flex items-start overflow-x-auto pb-1 -mx-1 px-1">
        {schritte.map((s, i) => {
          const z = zustand(s)
          return (
            <li key={s.key} className="flex items-start flex-1 min-w-[64px]">
              <div className="flex flex-col items-center text-center flex-1">
                <span className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold border-2 transition-colors',
                  z === 'erledigt' && 'bg-emerald-500 border-emerald-500 text-white',
                  z === 'aktuell' && 'bg-orange-500 border-orange-500 text-white ring-4 ring-orange-100',
                  z === 'offen' && 'bg-white border-slate-200 text-slate-400',
                )}>
                  {z === 'erledigt' ? <Check className="w-4 h-4" /> : i + 1}
                </span>
                <span className={cn(
                  'mt-1.5 text-[11px] sm:text-xs leading-tight font-medium break-words hyphens-auto',
                  z === 'aktuell' ? 'text-orange-700' : z === 'erledigt' ? 'text-slate-700' : 'text-slate-400',
                )} lang="de">{s.label}</span>
              </div>
              {i < schritte.length - 1 && (
                <span className={cn('h-0.5 flex-1 mt-4 -mx-3 min-w-[12px]', erledigt[s.key] ? 'bg-emerald-400' : 'bg-slate-200')} aria-hidden />
              )}
            </li>
          )
        })}
      </ol>

      {/* Nächster Schritt */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        {aktion.art === 'fertig' ? (
          <p className="text-sm text-slate-600 flex items-center gap-2">
            {geladen ? <Check className="w-4 h-4 text-emerald-500" /> : <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            {aktion.hinweis}
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Nächster Schritt</p>
              {aktion.hinweis && <p className="text-sm text-slate-600 mt-0.5">{aktion.hinweis}</p>}
              {fehler && <p className="text-sm text-red-600 mt-1">{fehler}</p>}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              {aktion.zweit && (
                <button type="button" onClick={aktion.zweit.los} className="text-sm text-slate-500 hover:text-slate-800 underline underline-offset-2 text-center">
                  {aktion.zweit.text}
                </button>
              )}
              {aktion.art === 'knopf' ? (
                <button
                  type="button"
                  onClick={aktion.los}
                  disabled={aktion.busy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold px-5 py-3 text-base shadow-sm transition-colors"
                >
                  {aktion.busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {aktion.text}
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <Link
                  href={aktion.href}
                  target="_blank"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-3 text-base shadow-sm transition-colors"
                >
                  {aktion.text}
                  <ChevronRight className="w-5 h-5" />
                </Link>
              )}
            </div>
          </div>
        )}
        {!istEigenfahrzeug && onAnnahme && !['ausgeliefert', 'verkauft', 'storniert'].includes(status) && (
          <div className="mt-3 text-sm">
            {annahme?.erfasst ? (
              <button type="button" onClick={onAnnahme} className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                <Check className="w-4 h-4" /> {annahme.text} <span className="text-slate-400 font-normal underline underline-offset-2">ändern</span>
              </button>
            ) : (
              <button type="button" onClick={onAnnahme} className="inline-flex items-center gap-1.5 font-semibold text-orange-700 hover:text-orange-800">
                <Camera className="w-4 h-4" /> Annahme erfassen <span className="text-slate-400 font-normal">(Kilometer, Tank, Fotos, Unterschrift)</span>
              </button>
            )}
          </div>
        )}
        {!istEigenfahrzeug && geladen && kvaOffen && !['ausgeliefert', 'verkauft'].includes(status) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {kvaOffen.status === 'akzeptiert' ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                <Check className="w-4 h-4" /> {freigabeText}
              </span>
            ) : kvaOffen.status === 'abgelehnt' ? (
              <span className="text-amber-700">Rückfrage vom Kunden{kvaOffen.freigabe_hinweis ? `: „${kvaOffen.freigabe_hinweis}“` : ''}</span>
            ) : kvaOffen.status === 'gesendet' ? (
              <span className="text-slate-500">Freigabe angefragt{kvaOffen.freigabe_gesendet_am ? ` am ${new Date(kvaOffen.freigabe_gesendet_am).toLocaleDateString('de-DE')}` : ''} — wartet auf den Kunden</span>
            ) : null}
            {kvaOffen.status !== 'akzeptiert' && (
              <button type="button" onClick={() => setFreigabeOffen(true)} className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-orange-600 transition-colors">
                <Send className="w-4 h-4" /> {kvaOffen.status === 'gesendet' || kvaOffen.status === 'abgelehnt' ? 'Link erneut senden' : 'Zur Freigabe an den Kunden senden'}
              </button>
            )}
          </div>
        )}
        {freigabeOffen && kvaOffen && (
          <FreigabeDialog
            kostenvoranschlagId={kvaOffen.id}
            kunde={kunde}
            fahrzeugName={fahrzeugName}
            firmaName={currentBetrieb?.name ?? ''}
            onClose={() => setFreigabeOffen(false)}
            onGesendet={() => setTick(t => t + 1)}
          />
        )}
        {!istEigenfahrzeug && geladen && !['fertig', 'ausgeliefert', 'verkauft'].includes(status) && (
          <button type="button" onClick={() => setPaketOffen(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors">
            <PackagePlus className="w-4 h-4" /> Leistungspaket hinzufügen
            <span className="hidden sm:inline text-slate-400 font-normal">(Ölwechsel, Inspektion … mit einem Klick)</span>
          </button>
        )}
        {paketOffen && (
          <LeistungspaketDialog
            auftragId={auftragId}
            betriebId={betriebId}
            onClose={() => setPaketOffen(false)}
            onUebernommen={() => { onPaketUebernommen(); setTick(t => t + 1) }}
          />
        )}
        {uebergeben && geladen && (
          <Link href={`/fahrzeuge/${auftragId}/mappe`} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-orange-700 hover:text-orange-800">
            <FolderOpen className="w-4 h-4" /> Auftragsmappe / Komplett-PDF öffnen
          </Link>
        )}
      </div>
    </section>
  )
}
