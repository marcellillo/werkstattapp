'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Calendar, Car, ShieldCheck, CalendarClock,
  AlertTriangle, Clock, CheckCircle, Plus, X, Search, User, UserPlus,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import { FAHRZEUG_STATUS_LABEL, FAHRZEUG_STATUS_COLOR, type FahrzeugStatus } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

type ViewMode = 'monat' | 'woche' | 'tag'

const TERMIN_TYP_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  tuev:      { label: 'TÜV',       color: 'bg-yellow-100 text-yellow-800 border-yellow-300', bg: 'bg-yellow-100', icon: ShieldCheck },
  werkstatt: { label: 'Werkstatt', color: 'bg-blue-100 text-blue-800 border-blue-300',       bg: 'bg-blue-100',   icon: CalendarClock },
  online:    { label: 'Online',    color: 'bg-purple-100 text-purple-800 border-purple-300', bg: 'bg-purple-100', icon: CalendarClock },
}

function getTerminCfg(typ: string) {
  return TERMIN_TYP_CFG[typ] ?? TERMIN_TYP_CFG['werkstatt']
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return d
}

function addWerktage(tage: number): string {
  const d = new Date()
  let verbleibend = Math.ceil(tage)
  while (verbleibend > 0) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) verbleibend--
  }
  return d.toISOString().split('T')[0]
}

// ── Kunden-Suche Dropdown ────────────────────────────────────────────────────
function KundenSuche({
  kunden,
  selectedId,
  onSelect,
  onNeukunde,
}: {
  kunden: any[]
  selectedId: string | null
  onSelect: (k: any) => void
  onNeukunde: () => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = kunden.find(k => k.id === selectedId)

  const filtered = useMemo(() => {
    if (!query.trim()) return kunden.slice(0, 20)
    const q = query.toLowerCase()
    return kunden.filter(k =>
      `${k.vorname} ${k.nachname}`.toLowerCase().includes(q) ||
      k.telefon?.includes(q) ||
      k.email?.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [kunden, query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? `${selected.vorname} ${selected.nachname}` : 'Kunde auswählen …'}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Name, Telefon …"
                className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')}>
                  <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Kein Kunde gefunden</p>
            )}
            {filtered.map(k => (
              <button
                key={k.id}
                type="button"
                onClick={() => { onSelect(k); setOpen(false); setQuery('') }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 text-left transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{k.vorname} {k.nachname}</p>
                  {k.telefon && <p className="text-xs text-gray-400 truncate">{k.telefon}</p>}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100">
            <button
              type="button"
              onClick={() => { setOpen(false); setQuery(''); onNeukunde() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              + Neukunde anlegen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Neuer Termin Seitenpanel ─────────────────────────────────────────────────
function TerminPanel({
  open,
  onClose,
  kunden,
  fahrzeuge,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  kunden: any[]
  fahrzeuge: any[]
  onSaved: (termin: any) => void
}) {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [titel, setTitel] = useState('')
  const [datum, setDatum] = useState(today)
  const [uhrzeit, setUhrzeit] = useState('')
  const [dauer, setDauer] = useState('')
  const [typ, setTyp] = useState('werkstatt')
  const [beschreibung, setBeschreibung] = useState('')
  const [selectedKundeId, setSelectedKundeId] = useState<string | null>(null)
  const [selectedFahrzeugId, setSelectedFahrzeugId] = useState<string | null>(null)

  // Neukunde inline
  const [showNeukunde, setShowNeukunde] = useState(false)
  const [neuVorname, setNeuVorname] = useState('')
  const [neuNachname, setNeuNachname] = useState('')
  const [neuTelefon, setNeuTelefon] = useState('')
  const [neuEmail, setNeuEmail] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const kundeFahrzeuge = useMemo(
    () => fahrzeuge.filter(f => f.kunde_id === selectedKundeId),
    [fahrzeuge, selectedKundeId],
  )

  function reset() {
    setTitel(''); setDatum(today); setUhrzeit(''); setDauer(''); setTyp('werkstatt')
    setBeschreibung(''); setSelectedKundeId(null); setSelectedFahrzeugId(null)
    setShowNeukunde(false); setNeuVorname(''); setNeuNachname(''); setNeuTelefon(''); setNeuEmail('')
    setError('')
  }

  function handleClose() { reset(); onClose() }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!titel.trim()) { setError('Titel ist erforderlich'); return }
    if (!datum) { setError('Datum ist erforderlich'); return }
    setSaving(true); setError('')

    try {
      let kundeId = selectedKundeId

      // Neukunde anlegen
      if (showNeukunde && neuNachname.trim()) {
        const { data: neuerKunde, error: kErr } = await supabase
          .from('kunden')
          .insert({ vorname: neuVorname.trim(), nachname: neuNachname.trim(), telefon: neuTelefon.trim() || null, email: neuEmail.trim() || null })
          .select('id')
          .single()
        if (kErr) throw kErr
        kundeId = neuerKunde.id
      }

      const { data: neu, error: tErr } = await supabase
        .from('termine')
        .insert({
          titel: titel.trim(),
          datum,
          uhrzeit: uhrzeit || null,
          dauer_minuten: dauer ? parseInt(dauer) : null,
          typ,
          status: 'geplant',
          beschreibung: beschreibung.trim() || null,
          kunde_id: kundeId || null,
          fahrzeug_id: selectedFahrzeugId || null,
        })
        .select('id, titel, datum, uhrzeit, dauer_minuten, typ, status, beschreibung, fahrzeug:fahrzeuge(marke, modell, kennzeichen), kunde:kunden(vorname, nachname)')
        .single()

      if (tErr) throw tErr
      onSaved(neu)
      reset()
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  // ESC schließt
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={handleClose}
        />
      )}

      {/* Panel */}
      <div className={cn(
        'fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Plus className="w-4 h-4 text-orange-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Neuer Termin</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Titel */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Titel *</label>
            <input
              type="text"
              value={titel}
              onChange={e => setTitel(e.target.value)}
              placeholder="z. B. Inspektion, TÜV-Vorbereitung …"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          {/* Typ */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Typ</label>
            <div className="flex gap-2">
              {Object.entries(TERMIN_TYP_CFG).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTyp(key)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-medium border transition-colors',
                    typ === key ? cfg.color + ' shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Datum & Uhrzeit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Datum *</label>
              <input
                type="date"
                value={datum}
                min={today}
                onChange={e => setDatum(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Uhrzeit</label>
              <input
                type="time"
                value={uhrzeit}
                onChange={e => setUhrzeit(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Dauer */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Dauer (Minuten)</label>
            <div className="flex gap-2">
              {['30', '60', '90', '120'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDauer(dauer === m ? '' : m)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    dauer === m ? 'bg-orange-100 border-orange-300 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  {m}&apos;
                </button>
              ))}
              <input
                type="number"
                min="5"
                step="5"
                value={dauer}
                onChange={e => setDauer(e.target.value)}
                placeholder="Min."
                className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Trennlinie */}
          <div className="border-t border-gray-100" />

          {/* Kunde */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-700">Kunde</label>
              {selectedKundeId && (
                <button
                  type="button"
                  onClick={() => { setSelectedKundeId(null); setSelectedFahrzeugId(null) }}
                  className="text-xs text-gray-400 hover:text-red-400"
                >
                  Entfernen
                </button>
              )}
            </div>

            {!showNeukunde ? (
              <KundenSuche
                kunden={kunden}
                selectedId={selectedKundeId}
                onSelect={k => { setSelectedKundeId(k.id); setSelectedFahrzeugId(null) }}
                onNeukunde={() => { setSelectedKundeId(null); setShowNeukunde(true) }}
              />
            ) : (
              <div className="border border-orange-200 rounded-xl p-3 space-y-2.5 bg-orange-50/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-orange-700 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" /> Neukunde anlegen
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNeukunde(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    ← Zurück
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={neuVorname}
                    onChange={e => setNeuVorname(e.target.value)}
                    placeholder="Vorname"
                    className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  />
                  <input
                    type="text"
                    value={neuNachname}
                    onChange={e => setNeuNachname(e.target.value)}
                    placeholder="Nachname *"
                    className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  />
                </div>
                <input
                  type="tel"
                  value={neuTelefon}
                  onChange={e => setNeuTelefon(e.target.value)}
                  placeholder="Telefon"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
                <input
                  type="email"
                  value={neuEmail}
                  onChange={e => setNeuEmail(e.target.value)}
                  placeholder="E-Mail"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
              </div>
            )}
          </div>

          {/* Fahrzeug (nur wenn Kunde ausgewählt) */}
          {selectedKundeId && kundeFahrzeuge.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Fahrzeug</label>
              <div className="space-y-1.5">
                {kundeFahrzeuge.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFahrzeugId(selectedFahrzeugId === f.id ? null : f.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors',
                      selectedFahrzeugId === f.id
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <Car className={cn('w-4 h-4 flex-shrink-0', selectedFahrzeugId === f.id ? 'text-orange-500' : 'text-gray-400')} />
                    <span className="text-sm text-gray-900">{f.marke} {f.modell}</span>
                    <span className="text-xs text-gray-500 font-mono ml-auto">{f.kennzeichen}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Beschreibung */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Notiz / Beschreibung</label>
            <textarea
              value={beschreibung}
              onChange={e => setBeschreibung(e.target.value)}
              rows={3}
              placeholder="Optionale Anmerkungen …"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saving ? 'Speichern …' : 'Termin anlegen'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Haupt-Komponente ─────────────────────────────────────────────────────────
export function KalenderContent({
  auftraege: initialAuftraege,
  termine: initialTermine = [],
  kunden = [],
  fahrzeuge = [],
}: {
  auftraege: any[]
  termine?: any[]
  kunden?: any[]
  fahrzeuge?: any[]
}) {
  const [auftraege, setAuftraege] = useState(initialAuftraege)
  const [termine, setTermine] = useState(initialTermine)
  const [view, setView] = useState<ViewMode>('monat')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [settingDateFor, setSettingDateFor] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const supabase = createClient()

  const mitDatum   = auftraege.filter(a => a.geplante_fertigstellung)
  const ohneDatum  = auftraege.filter(a => !a.geplante_fertigstellung)
  const today      = new Date().toISOString().split('T')[0]
  const ueberfaellig = mitDatum.filter(a => a.geplante_fertigstellung < today)

  // Automatische TÜV- und Service-Erinnerungen (30 & 60 Tage vorher)
  const autoErinnerungen = useMemo(() => {
    const events: any[] = []
    for (const f of fahrzeuge) {
      if (f.tuev_erinnerung && f.naechste_hauptuntersuchung) {
        const hu = new Date(f.naechste_hauptuntersuchung + 'T00:00:00')
        for (const tage of [60, 30]) {
          const d = new Date(hu)
          d.setDate(d.getDate() - tage)
          events.push({
            id: `tuev-${f.id}-${tage}`,
            titel: `TÜV in ${tage} Tagen — ${f.kennzeichen}`,
            datum: d.toISOString().split('T')[0],
            typ: 'tuev',
            isAuto: true,
            fahrzeug: f,
            beschreibung: `${f.marke} ${f.modell} · HU fällig am ${new Date(f.naechste_hauptuntersuchung + 'T00:00:00').toLocaleDateString('de-DE')}`,
          })
        }
      }
      if (f.naechster_service_datum) {
        const sv = new Date(f.naechster_service_datum + 'T00:00:00')
        for (const tage of [60, 30]) {
          const d = new Date(sv)
          d.setDate(d.getDate() - tage)
          events.push({
            id: `service-${f.id}-${tage}`,
            titel: `Service in ${tage} Tagen — ${f.kennzeichen}`,
            datum: d.toISOString().split('T')[0],
            typ: 'werkstatt',
            isAuto: true,
            fahrzeug: f,
            beschreibung: `${f.marke} ${f.modell} · Service fällig am ${new Date(f.naechster_service_datum + 'T00:00:00').toLocaleDateString('de-DE')}`,
          })
        }
      }
    }
    return events
  }, [fahrzeuge])

  async function setFertigstellung(auftragId: string, datum: string) {
    setAuftraege(prev => prev.map(a => a.id === auftragId ? { ...a, geplante_fertigstellung: datum } : a))
    setSettingDateFor(null)
    await supabase.from('auftraege').update({ geplante_fertigstellung: datum }).eq('id', auftragId)
  }

  async function clearFertigstellung(auftragId: string) {
    setAuftraege(prev => prev.map(a => a.id === auftragId ? { ...a, geplante_fertigstellung: null } : a))
    await supabase.from('auftraege').update({ geplante_fertigstellung: null }).eq('id', auftragId)
  }

  function handleTerminSaved(termin: any) {
    setTermine(prev => [...prev, termin].sort((a, b) => a.datum.localeCompare(b.datum)))
  }

  function navigate(delta: number) {
    const d = new Date(currentDate)
    if (view === 'monat') d.setMonth(d.getMonth() + delta)
    else if (view === 'woche') d.setDate(d.getDate() + delta * 7)
    else d.setDate(d.getDate() + delta)
    setCurrentDate(d)
  }

  const formatHeader = () => {
    if (view === 'monat') return currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    if (view === 'woche') {
      const start = getWeekStart(currentDate)
      const end = new Date(start); end.setDate(end.getDate() + 6)
      return `${formatDate(start.toISOString().split('T')[0])} – ${formatDate(end.toISOString().split('T')[0])}`
    }
    return currentDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  }

  function getAuftraegeForDate(date: Date) {
    const d = date.toISOString().split('T')[0]
    return auftraege.filter(a => a.geplante_fertigstellung === d)
  }
  function getTermineForDate(date: Date) {
    const d = date.toISOString().split('T')[0]
    return [
      ...termine.filter(t => t.datum === d),
      ...autoErinnerungen.filter(t => t.datum === d),
    ]
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kalender</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {mitDatum.length} geplante Fertigstellungen · {termine.length} Termine
            {ueberfaellig.length > 0 && <span className="ml-2 text-red-600 font-medium">· {ueberfaellig.length} überfällig</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Neuer Termin
          </button>
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            {(['tag', 'woche', 'monat'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
                  view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-700')}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legende */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5 text-gray-500"><span className="w-3 h-3 rounded-sm bg-orange-200 inline-block" /> Fertigstellung</span>
        <span className="flex items-center gap-1.5 text-gray-500"><span className="w-3 h-3 rounded-sm bg-red-200 inline-block" /> Überfällig</span>
        <span className="flex items-center gap-1.5 text-gray-500"><span className="w-3 h-3 rounded-sm bg-yellow-200 inline-block" /> TÜV-Erinnerung</span>
        <span className="flex items-center gap-1.5 text-gray-500"><span className="w-3 h-3 rounded-sm bg-blue-200 inline-block" /> Service-Erinnerung</span>
        <span className="flex items-center gap-1.5 text-gray-500"><span className="w-3 h-3 rounded-sm bg-blue-200 inline-block" /> Werkstatttermin</span>
        <span className="flex items-center gap-1.5 text-gray-500"><span className="w-3 h-3 rounded-sm bg-yellow-200 inline-block" /> TÜV</span>
      </div>

      {/* Überfällig-Banner */}
      {ueberfaellig.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">{ueberfaellig.length} {ueberfaellig.length === 1 ? 'Fahrzeug ist' : 'Fahrzeuge sind'} überfällig</p>
            <div className="mt-1 space-y-0.5">
              {ueberfaellig.map(a => (
                <Link key={a.id} href={`/fahrzeuge/${a.id}`} className="flex items-center gap-2 text-xs text-red-700 hover:text-red-900">
                  <Car className="w-3 h-3" />
                  {a.fahrzeug?.marke} {a.fahrzeug?.modell} · {a.fahrzeug?.kennzeichen}
                  <span className="font-mono opacity-70">— geplant: {formatDate(a.geplante_fertigstellung)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="font-semibold text-gray-800 text-sm md:text-base">{formatHeader()}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date())} className="text-xs text-orange-600 hover:text-orange-700 font-medium px-2 py-1 rounded hover:bg-orange-50">
            Heute
          </button>
          <button onClick={() => navigate(1)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Calendar Views */}
      {view === 'monat' && <MonthView currentDate={currentDate} getAuftraegeForDate={getAuftraegeForDate} getTermineForDate={getTermineForDate} />}
      {view === 'woche' && <WeekView currentDate={currentDate} getAuftraegeForDate={getAuftraegeForDate} getTermineForDate={getTermineForDate} />}
      {view === 'tag'   && <DayView  currentDate={currentDate} getAuftraegeForDate={getAuftraegeForDate} getTermineForDate={getTermineForDate} />}

      {/* Ohne Termin */}
      {ohneDatum.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-yellow-500" />
            <h3 className="text-base font-semibold text-gray-800">Noch kein Fertigstellungstermin</h3>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">{ohneDatum.length}</span>
          </div>
          <div className="space-y-2">
            {ohneDatum.map(a => (
              <div key={a.id} className="bg-white border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-4">
                <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/fahrzeuge/${a.id}`} className="font-medium text-gray-900 text-sm hover:text-orange-600">
                    {a.fahrzeug?.marke} {a.fahrzeug?.modell}
                  </Link>
                  <p className="text-xs text-gray-500 font-mono">{a.fahrzeug?.kennzeichen}{a.kunde ? ` · ${a.kunde.vorname} ${a.kunde.nachname}` : ''}</p>
                  {a.arbeiten && <p className="text-xs text-gray-400 truncate mt-0.5">{a.arbeiten}</p>}
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0', FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus])}>
                  {FAHRZEUG_STATUS_LABEL[a.status as FahrzeugStatus]}
                </span>
                <div className="flex-shrink-0">
                  {settingDateFor === a.id ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          min={today}
                          defaultValue={a.geschaetzte_dauer_tage ? addWerktage(a.geschaetzte_dauer_tage) : today}
                          autoFocus
                          className="border border-orange-400 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          onKeyDown={e => { if (e.key === 'Escape') setSettingDateFor(null) }}
                          onChange={e => { if (e.target.value) setFertigstellung(a.id, e.target.value) }}
                        />
                        <button onClick={() => setSettingDateFor(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                      {a.geschaetzte_dauer_tage && (
                        <button
                          onClick={() => setFertigstellung(a.id, addWerktage(a.geschaetzte_dauer_tage))}
                          className="text-xs text-orange-600 hover:text-orange-800"
                        >
                          Vorschlag: {formatDate(addWerktage(a.geschaetzte_dauer_tage))} ({a.geschaetzte_dauer_tage} {a.geschaetzte_dauer_tage === 1 ? 'Tag' : 'Tage'}) übernehmen
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => setSettingDateFor(a.id)}
                        className="flex items-center gap-1.5 text-xs bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Termin setzen
                      </button>
                      {a.geschaetzte_dauer_tage && (
                        <span className="text-xs text-gray-400">ca. {a.geschaetzte_dauer_tage} {a.geschaetzte_dauer_tage === 1 ? 'Tag' : 'Tage'}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alle geplanten Fertigstellungen & Termine */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          Geplante Fertigstellungen &amp; Termine
        </h3>
        {mitDatum.length === 0 && termine.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500">Keine Termine geplant</p>
              <p className="text-xs text-gray-400 mt-1">Setze bei jedem Fahrzeug oben einen Termin oder klicke <button onClick={() => setPanelOpen(true)} className="text-orange-500 hover:underline">Neuer Termin</button></p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {termine.map(t => {
              const cfg = getTerminCfg(t.typ)
              const Icon = cfg.icon
              return (
                <div key={`termin-${t.id}`} className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-colors">
                  <div className={cn('w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center flex-shrink-0', cfg.bg)}>
                    <span className="text-xs font-bold text-gray-700">{new Date(t.datum + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit' })}</span>
                    <span className="text-xs text-gray-500">{new Date(t.datum + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <p className="font-medium text-gray-900 text-sm truncate">{t.titel}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {t.uhrzeit ? `${t.uhrzeit.slice(0,5)} Uhr` : 'Ganztägig'}
                      {t.dauer_minuten ? ` · ${t.dauer_minuten} Min.` : ''}
                      {t.fahrzeug?.kennzeichen ? ` · ${t.fahrzeug.kennzeichen}` : ''}
                      {t.kunde?.nachname ? ` · ${t.kunde.vorname} ${t.kunde.nachname}` : ''}
                    </p>
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0', cfg.color)}>{cfg.label}</span>
                </div>
              )
            })}

            {[...mitDatum].sort((a, b) => (a.geplante_fertigstellung ?? '').localeCompare(b.geplante_fertigstellung ?? '')).map(a => {
              const overdue = a.geplante_fertigstellung < today
              return (
                <div key={`auftrag-${a.id}`} className={cn(
                  'flex items-center gap-4 px-4 py-3 bg-white border rounded-xl transition-colors',
                  overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
                )}>
                  <div className={cn('w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center flex-shrink-0', overdue ? 'bg-red-100' : 'bg-orange-100')}>
                    <span className={cn('text-xs font-bold', overdue ? 'text-red-600' : 'text-orange-600')}>
                      {new Date(a.geplante_fertigstellung + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit' })}
                    </span>
                    <span className={cn('text-xs', overdue ? 'text-red-500' : 'text-orange-500')}>
                      {new Date(a.geplante_fertigstellung + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' })}
                    </span>
                  </div>
                  <Link href={`/fahrzeuge/${a.id}`} className="flex-1 min-w-0 hover:text-orange-600">
                    <div className="flex items-center gap-2">
                      <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <p className="font-medium text-gray-900 text-sm">{a.fahrzeug?.marke} {a.fahrzeug?.modell}</p>
                      <span className="text-xs text-gray-500 font-mono">{a.fahrzeug?.kennzeichen}</span>
                    </div>
                    <p className="text-xs text-gray-500">{a.kunde?.vorname} {a.kunde?.nachname}</p>
                    {a.arbeiten && <p className="text-xs text-gray-400 mt-0.5 truncate">{a.arbeiten}</p>}
                  </Link>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs border font-medium', FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus])}>
                      {FAHRZEUG_STATUS_LABEL[a.status as FahrzeugStatus]}
                    </span>
                    {overdue && <span className="text-xs text-red-600 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Überfällig</span>}
                    <button
                      onClick={() => clearFertigstellung(a.id)}
                      className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                    >
                      Termin entfernen
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Neuer Termin Panel */}
      <TerminPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        kunden={kunden}
        fahrzeuge={fahrzeuge}
        onSaved={handleTerminSaved}
      />
    </div>
  )
}

// ── Month View ──────────────────────────────────────────────────────────────
function MonthView({ currentDate, getAuftraegeForDate, getTermineForDate }: {
  currentDate: Date; getAuftraegeForDate: (d: Date) => any[]; getTermineForDate: (d: Date) => any[]
}) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const today = new Date().toISOString().split('T')[0]
  const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  const days: (Date | null)[] = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map(d => <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="min-h-[80px] border-r border-b border-gray-50" />
          const dateStr = day.toISOString().split('T')[0]
          const dayAuftraege = getAuftraegeForDate(day)
          const dayTermine   = getTermineForDate(day)
          const isToday = dateStr === today
          const hasOverdue = dayAuftraege.some(a => a.geplante_fertigstellung < today)
          const total = dayAuftraege.length + dayTermine.length
          return (
            <div key={dateStr} className={cn('min-h-[80px] p-1.5 border-r border-b border-gray-50 last:border-r-0', isToday ? 'bg-orange-50' : 'hover:bg-gray-50/50')}>
              <span className={cn('inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium mb-1',
                isToday ? 'bg-orange-500 text-white' : hasOverdue ? 'text-red-600 font-bold' : 'text-gray-700')}>
                {day.getDate()}
              </span>
              {dayTermine.slice(0, 1).map(t => {
                const cfg = getTerminCfg(t.typ)
                return (
                  <div key={t.id} className={cn('text-xs px-1.5 py-0.5 rounded truncate mb-0.5 font-medium border', cfg.color)}>
                    {t.uhrzeit ? t.uhrzeit.slice(0,5) + ' ' : ''}{t.titel}
                  </div>
                )
              })}
              {dayAuftraege.slice(0, dayTermine.length > 0 ? 1 : 2).map(a => {
                const overdue = a.geplante_fertigstellung < today
                return (
                  <Link key={a.id} href={`/fahrzeuge/${a.id}`}>
                    <div className={cn('text-xs px-1.5 py-0.5 rounded truncate mb-0.5 font-medium border',
                      overdue ? 'bg-red-100 text-red-700 border-red-300' : FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus])}>
                      {a.fahrzeug?.kennzeichen}
                    </div>
                  </Link>
                )
              })}
              {total > 2 && <span className="text-xs text-gray-400">+{total - 2}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week View ───────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8) // 08 – 18

function WeekView({ currentDate, getAuftraegeForDate, getTermineForDate }: {
  currentDate: Date; getAuftraegeForDate: (d: Date) => any[]; getTermineForDate: (d: Date) => any[]
}) {
  const start = getWeekStart(currentDate)
  const days  = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
  const today = new Date().toISOString().split('T')[0]
  const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Day headers */}
      <div className="grid border-b border-gray-100" style={{gridTemplateColumns: '48px repeat(7, 1fr)'}}>
        <div className="border-r border-gray-100" />
        {days.map((day, i) => {
          const dateStr = day.toISOString().split('T')[0]
          const isToday = dateStr === today
          const allItems = [...getTermineForDate(day), ...getAuftraegeForDate(day)]
          return (
            <div key={dateStr} className={cn('py-2 px-1 text-center border-r border-gray-100 last:border-r-0', isToday ? 'bg-orange-50' : '')}>
              <p className={cn('text-xs font-semibold', isToday ? 'text-orange-600' : 'text-gray-500')}>{WEEKDAYS[i]}</p>
              <p className={cn('text-sm font-bold', isToday ? 'text-orange-600' : 'text-gray-800')}>{day.getDate()}</p>
              {allItems.length > 0 && <div className={cn('w-1.5 h-1.5 rounded-full mx-auto mt-0.5', isToday ? 'bg-orange-400' : 'bg-blue-400')} />}
            </div>
          )
        })}
      </div>

      {/* Ganztägig row */}
      {days.some(d => {
        const ts = getTermineForDate(d).filter(t => !t.uhrzeit)
        const as = getAuftraegeForDate(d)
        return ts.length > 0 || as.length > 0
      }) && (
        <div className="grid border-b border-gray-100" style={{gridTemplateColumns: '48px repeat(7, 1fr)'}}>
          <div className="border-r border-gray-100 flex items-center justify-center py-1">
            <span className="text-[10px] text-gray-400 writing-mode-vertical" style={{writingMode:'vertical-lr',transform:'rotate(180deg)'}}>Ganztag</span>
          </div>
          {days.map(day => {
            const dateStr = day.toISOString().split('T')[0]
            const isToday = dateStr === today
            const termineGanztag = getTermineForDate(day).filter(t => !t.uhrzeit)
            const auftraege = getAuftraegeForDate(day)
            return (
              <div key={dateStr} className={cn('border-r border-gray-100 last:border-r-0 p-1 min-h-[36px]', isToday ? 'bg-orange-50/50' : '')}>
                {termineGanztag.map(t => {
                  const cfg = getTerminCfg(t.typ)
                  return (
                    <div key={t.id} className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium truncate mb-0.5 border', cfg.color)}>{t.titel}</div>
                  )
                })}
                {auftraege.map(a => {
                  const overdue = a.geplante_fertigstellung < today
                  return (
                    <Link key={a.id} href={`/fahrzeuge/${a.id}`}>
                      <div className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium truncate mb-0.5 border',
                        overdue ? 'bg-red-100 text-red-700 border-red-300' : 'bg-orange-100 text-orange-700 border-orange-300')}>
                        {a.fahrzeug?.kennzeichen}{overdue ? ' ⚠' : ''}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="overflow-y-auto" style={{maxHeight: '480px'}}>
        {HOURS.map(hour => (
          <div key={hour} className="grid border-b border-gray-50 last:border-b-0" style={{gridTemplateColumns: '48px repeat(7, 1fr)', minHeight: '52px'}}>
            <div className="border-r border-gray-100 flex items-start justify-end pr-2 pt-1 flex-shrink-0">
              <span className="text-[10px] text-gray-400 font-mono">{String(hour).padStart(2,'0')}:00</span>
            </div>
            {days.map(day => {
              const dateStr = day.toISOString().split('T')[0]
              const isToday = dateStr === today
              const termineAtHour = getTermineForDate(day).filter(t => {
                if (!t.uhrzeit) return false
                const h = parseInt(t.uhrzeit.slice(0, 2))
                return h === hour
              })
              return (
                <div key={dateStr} className={cn('border-r border-gray-50 last:border-r-0 p-0.5', isToday ? 'bg-orange-50/30' : 'hover:bg-gray-50/50')}>
                  {termineAtHour.map(t => {
                    const cfg = getTerminCfg(t.typ)
                    return (
                      <div key={t.id} className={cn('text-[10px] px-1.5 py-1 rounded font-medium truncate border mb-0.5', cfg.color)}>
                        <span className="font-bold">{t.uhrzeit.slice(0,5)}</span> {t.titel}
                        {t.dauer_minuten && <span className="opacity-60"> {t.dauer_minuten}'</span>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Day View ────────────────────────────────────────────────────────────────
function DayView({ currentDate, getAuftraegeForDate, getTermineForDate }: {
  currentDate: Date; getAuftraegeForDate: (d: Date) => any[]; getTermineForDate: (d: Date) => any[]
}) {
  const dayAuftraege = getAuftraegeForDate(currentDate)
  const dayTermine   = getTermineForDate(currentDate)
  const today        = new Date().toISOString().split('T')[0]

  const termineGanztag = dayTermine.filter(t => !t.uhrzeit)
  const termineZeit    = dayTermine.filter(t => !!t.uhrzeit)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Ganztägige Einträge */}
      {(termineGanztag.length > 0 || dayAuftraege.length > 0) && (
        <div className="border-b border-gray-100 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ganztägig / Fertigstellungen</p>
          {termineGanztag.map(t => {
            const cfg = getTerminCfg(t.typ)
            const Icon = cfg.icon
            return (
              <div key={t.id} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl border', cfg.color)}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium flex-1 min-w-0 truncate">{t.titel}</span>
                {t.dauer_minuten && <span className="text-xs opacity-60">{t.dauer_minuten} Min.</span>}
              </div>
            )
          })}
          {dayAuftraege.map(a => {
            const overdue = a.geplante_fertigstellung < today
            return (
              <Link key={a.id} href={`/fahrzeuge/${a.id}`}>
                <div className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl border', overdue ? 'bg-red-100 border-red-300 text-red-700' : 'bg-orange-100 border-orange-300 text-orange-700')}>
                  <Car className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{a.fahrzeug?.marke} {a.fahrzeug?.modell} · {a.fahrzeug?.kennzeichen}</span>
                    {a.kunde && <span className="text-xs opacity-70 ml-2">{a.kunde.vorname} {a.kunde.nachname}</span>}
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0', FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus])}>
                    {FAHRZEUG_STATUS_LABEL[a.status as FahrzeugStatus]}
                  </span>
                  {overdue && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Zeit-Einträge */}
      {termineZeit.length === 0 && dayAuftraege.length === 0 && termineGanztag.length === 0 ? (
        <div className="py-12 text-center">
          <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-gray-400 text-sm">Keine Einträge an diesem Tag</p>
        </div>
      ) : (
        <div className="overflow-y-auto" style={{maxHeight: '480px'}}>
          {HOURS.map(hour => {
            const events = termineZeit.filter(t => parseInt(t.uhrzeit.slice(0, 2)) === hour)
            return (
              <div key={hour} className={cn('flex border-b border-gray-50 last:border-b-0', events.length > 0 ? 'bg-blue-50/30' : '')} style={{minHeight: '52px'}}>
                <div className="w-16 flex-shrink-0 flex items-start justify-end pr-3 pt-2">
                  <span className="text-xs text-gray-400 font-mono">{String(hour).padStart(2,'0')}:00</span>
                </div>
                <div className="flex-1 border-l border-gray-100 p-1 space-y-1">
                  {events.map(t => {
                    const cfg = getTerminCfg(t.typ)
                    const Icon = cfg.icon
                    return (
                      <div key={t.id} className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border', cfg.color)}>
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{t.titel}</p>
                          <p className="text-xs opacity-70">
                            {t.uhrzeit.slice(0,5)} Uhr
                            {t.dauer_minuten ? ` · ${t.dauer_minuten} Min.` : ''}
                            {t.fahrzeug?.kennzeichen ? ` · ${t.fahrzeug.kennzeichen}` : ''}
                          </p>
                        </div>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', cfg.color)}>{cfg.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
