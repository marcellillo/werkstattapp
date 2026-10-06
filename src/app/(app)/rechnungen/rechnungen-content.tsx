'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Receipt, Upload, X, ChevronDown, ChevronUp, Package, Loader2, CheckCircle, AlertCircle, Mail,
  AlertTriangle, Trash2, FileText, Download, Search, Pencil, Save, ExternalLink, Paperclip,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DecimalField } from '@/components/ui/decimal-field'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Position = {
  id: string
  bezeichnung: string
  teilenummer: string | null
  menge: number
  einzelpreis: number | null
  gesamtpreis: number | null
}

type Rechnung = {
  id: string
  lieferant: string | null
  rechnungsnummer: string | null
  datum: string | null
  faellig_am: string | null
  gesamt: number | null
  bezahlt: boolean
  bezahlt_am: string | null
  erstellt_am: string
  notizen: string | null
  datei_pfad: string | null
  datei_name: string | null
  quelle: string | null
  absender_email: string | null
  email_betreff: string | null
  email_empfangen_am: string | null
  email_link: string | null
  pruefen: boolean
  positionen: Position[]
}

type EmailStatus = {
  verbunden: boolean
  aktiv: boolean
  letzterSync: string | null
  fehler: string
  adresse: string
}

type Bearbeiten = {
  id: string
  lieferant: string
  rechnungsnummer: string
  datum: string
  faellig_am: string
  gesamt: number
  bezahlt_am: string
  notizen: string
}

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 // Grenze der Vercel-Funktionen für Request-Bodies

// Datumsangaben ohne Uhrzeit ("2026-10-06") als lokalen Tag behandeln, nicht als UTC
function fmt(d?: string | null) {
  if (!d) return null
  const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function euro(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function heuteLokal() {
  return new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD in lokaler Zeit
}

export function RechnungenContent({
  rechnungen: initial, isAdmin = false, email, ladefehler = null,
}: { rechnungen: Rechnung[]; isAdmin?: boolean; email: EmailStatus; ladefehler?: string | null }) {
  const [rechnungen, setRechnungen] = useState(initial)
  const [uploadInfo, setUploadInfo] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncStill, setSyncStill] = useState(false)
  const [fehler, setFehler] = useState<string | null>(ladefehler)
  const [erfolg, setErfolg] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [filter, setFilter] = useState<'alle' | 'offen' | 'bezahlt' | 'pruefen'>('alle')
  const [suche, setSuche] = useState('')
  const [loeschenId, setLoeschenId] = useState<string | null>(null)
  const [loeschend, setLoeschend] = useState(false)
  const [edit, setEdit] = useState<Bearbeiten | null>(null)
  const [speichert, setSpeichert] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const syncLaeuft = useRef(false)
  const supabase = createClient()
  const uploading = uploadInfo !== null

  async function ladeListe() {
    const res = await fetch('/api/rechnung-import/list')
    if (res.ok) {
      const { rechnungen: neu } = await res.json()
      setRechnungen(neu)
    }
  }

  // E-Mail-Postfach abrufen. Bei vielen neuen Mails braucht ein Aufruf mehrere Runden (Zeitbudget
  // pro Aufruf), deshalb wird wiederholt, solange etwas übrig bleibt und Fortschritt entsteht.
  async function emailAbrufen(tage: number, still: boolean) {
    if (syncLaeuft.current) return
    syncLaeuft.current = true
    setSyncing(true); setSyncStill(still)
    if (!still) { setFehler(null); setErfolg(null) }

    let geprueft = 0, importiert = 0, duplikate = 0
    const uebersprungen: string[] = [], probleme: string[] = []
    let abbruch: string | null = null
    try {
      let vorher = Infinity
      for (let runde = 0; runde < 8; runde++) {
        const res = await fetch('/api/email-sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tage }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.erfolg) { abbruch = data.error ?? `Abruf fehlgeschlagen (${res.status})`; break }
        geprueft = Math.max(geprueft, data.emailsGeprueft ?? 0)
        importiert += data.rechnungenImportiert ?? 0
        duplikate += data.duplikate ?? 0
        uebersprungen.push(...(data.uebersprungen ?? []))
        for (const f of data.fehler ?? []) if (!probleme.includes(f)) probleme.push(f)
        const rest = data.verbleibend ?? 0
        if (!rest || rest >= vorher) break
        vorher = rest
      }
      if (importiert > 0) await ladeListe()

      if (abbruch) {
        if (!still) setFehler(abbruch)
      } else if (!still) {
        let msg = `${geprueft} E-Mails geprüft — ` + (importiert > 0 ? `${importiert} Rechnung${importiert !== 1 ? 'en' : ''} importiert` : 'keine neuen Rechnungen')
        if (duplikate > 0) msg += ` (${duplikate} bereits vorhanden)`
        if (uebersprungen.length > 0) msg += `\nKeine Rechnung, übersprungen: ${uebersprungen.slice(0, 5).join(', ')}${uebersprungen.length > 5 ? ' …' : ''}`
        if (probleme.length > 0) msg += `\n⚠️ ${probleme.join('\n⚠️ ')}`
        setErfolg(msg)
      } else if (importiert > 0) {
        setErfolg(`${importiert} neue Rechnung${importiert !== 1 ? 'en' : ''} aus dem E-Mail-Postfach importiert`)
      }
    } catch (e: any) {
      if (!still) setFehler(e.message)
    } finally {
      syncLaeuft.current = false
      setSyncing(false)
    }
  }

  // Beim Öffnen der Seite (wenn der letzte Abruf länger her ist) und danach alle 15 Minuten
  useEffect(() => {
    if (!email.verbunden || !email.aktiv || email.fehler) return
    const veraltet = !email.letzterSync || Date.now() - new Date(email.letzterSync).getTime() > 20 * 60 * 1000
    if (veraltet) emailAbrufen(14, true)
    const interval = setInterval(() => emailAbrufen(14, true), 15 * 60 * 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function dateienHochladen(dateien: File[]) {
    if (!dateien.length) return
    setFehler(null); setErfolg(null)
    let neu = 0, vorhanden = 0
    const probleme: string[] = []
    let letzteId: string | null = null

    for (let i = 0; i < dateien.length; i++) {
      const file = dateien[i]
      setUploadInfo(dateien.length > 1 ? `${i + 1} von ${dateien.length}: ${file.name}` : file.name)
      if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) { probleme.push(`${file.name}: nur PDF oder Bilder erlaubt`); continue }
      if (file.size > MAX_UPLOAD_BYTES) { probleme.push(`${file.name}: zu groß (max. 4 MB) – bitte verkleinern oder per E-Mail schicken`); continue }
      try {
        const fd = new FormData(); fd.append('datei', file)
        const res = await fetch('/api/rechnung-import', { method: 'POST', body: fd })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.erfolg) { probleme.push(`${file.name}: ${data.error ?? (res.status === 413 ? 'zu groß' : `Fehler ${res.status}`)}`); continue }
        letzteId = data.rechnungId
        if (data.duplikat) vorhanden++; else neu++
      } catch (e: any) {
        probleme.push(`${file.name}: ${e.message}`)
      }
    }

    await ladeListe()
    setUploadInfo(null)
    if (neu + vorhanden > 0) {
      let msg = neu > 0 ? `${neu} Rechnung${neu !== 1 ? 'en' : ''} importiert` : 'Keine neue Rechnung'
      if (vorhanden > 0) msg += ` (${vorhanden} war${vorhanden !== 1 ? 'en' : ''} schon vorhanden)`
      setErfolg(msg)
      if (dateien.length === 1 && letzteId) setExpandedId(letzteId)
    }
    if (probleme.length) setFehler(probleme.join('\n'))
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    dateienHochladen(Array.from(files))
  }

  async function setzeStatus(r: Rechnung, bezahlt: boolean) {
    if (r.bezahlt === bezahlt) return
    const vorher = { bezahlt: r.bezahlt, bezahlt_am: r.bezahlt_am }
    const neu = { bezahlt, bezahlt_am: bezahlt ? (r.bezahlt_am ?? heuteLokal()) : null }
    setRechnungen(prev => prev.map(x => x.id === r.id ? { ...x, ...neu } : x))
    const { data, error } = await supabase.from('rechnungen').update(neu).eq('id', r.id).select('id')
    if (error || !data?.length) {
      setRechnungen(prev => prev.map(x => x.id === r.id ? { ...x, ...vorher } : x))
      setFehler(`Status konnte nicht gespeichert werden${error ? `: ${error.message}` : ' (keine Berechtigung)'}`)
    }
  }

  function bearbeitenStarten(r: Rechnung) {
    setEdit({
      id: r.id,
      lieferant: r.lieferant ?? '',
      rechnungsnummer: r.rechnungsnummer ?? '',
      datum: r.datum ?? '',
      faellig_am: r.faellig_am ?? '',
      gesamt: r.gesamt ?? 0,
      bezahlt_am: r.bezahlt_am ?? '',
      notizen: r.notizen ?? '',
    })
  }

  async function bearbeitenSpeichern(r: Rechnung) {
    if (!edit) return
    setSpeichert(true); setFehler(null)
    const felder = {
      lieferant: edit.lieferant.trim() || null,
      rechnungsnummer: edit.rechnungsnummer.trim() || null,
      datum: edit.datum || null,
      faellig_am: edit.faellig_am || null,
      gesamt: edit.gesamt === 0 && r.gesamt == null ? null : Math.round(edit.gesamt * 100) / 100,
      bezahlt_am: r.bezahlt ? (edit.bezahlt_am || r.bezahlt_am) : null,
      notizen: edit.notizen.trim() || null,
      pruefen: false, // von Hand kontrolliert
    }
    const { data, error } = await supabase.from('rechnungen').update(felder).eq('id', r.id).select('id')
    setSpeichert(false)
    if (error || !data?.length) {
      setFehler(`Änderungen konnten nicht gespeichert werden${error ? `: ${error.message}` : ' (keine Berechtigung)'}`)
      return
    }
    setRechnungen(prev => prev.map(x => x.id === r.id ? { ...x, ...felder } : x))
    setEdit(null)
  }

  async function loeschenBestaetigen(id: string) {
    setLoeschend(true); setFehler(null)
    try {
      const res = await fetch('/api/rechnung-import/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(data.error ?? 'Löschen fehlgeschlagen'); return }
      setRechnungen(prev => prev.filter(r => r.id !== id))
      setLoeschenId(null); setExpandedId(null)
    } finally {
      setLoeschend(false)
    }
  }

  const heute = heuteLokal()
  const sortiert = useMemo(
    () => [...rechnungen].sort((a, b) => (b.datum ?? b.erstellt_am.slice(0, 10)).localeCompare(a.datum ?? a.erstellt_am.slice(0, 10))),
    [rechnungen],
  )
  const zuPruefen = rechnungen.filter(r => r.pruefen)
  const gefiltert = sortiert.filter(r => {
    if (filter === 'offen' && r.bezahlt) return false
    if (filter === 'bezahlt' && !r.bezahlt) return false
    if (filter === 'pruefen' && !r.pruefen) return false
    const q = suche.trim().toLowerCase()
    if (!q) return true
    return [r.lieferant, r.rechnungsnummer, r.notizen, r.email_betreff, r.gesamt != null ? String(r.gesamt).replace('.', ',') : '']
      .some(v => (v ?? '').toLowerCase().includes(q))
  })
  const offene = rechnungen.filter(r => !r.bezahlt)
  const ueberfaellig = offene.filter(r => r.faellig_am && r.faellig_am < heute)
  const offenBetrag = offene.reduce((s, r) => s + (r.gesamt ?? 0), 0)
  const gesamtBetrag = rechnungen.reduce((s, r) => s + (r.gesamt ?? 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lieferantenrechnungen</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rechnungen.length} Rechnungen · {offene.length} offen</p>
        </div>
        {email.verbunden && !email.fehler && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => emailAbrufen(90, false)} disabled={syncing}
              className="text-xs text-slate-500 hover:text-slate-800 underline disabled:opacity-50" title="Auch ältere E-Mails der letzten 90 Tage einlesen">
              ältere laden (90 Tage)
            </button>
            <Button onClick={() => emailAbrufen(14, false)} disabled={syncing}>
              {syncing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Prüfe…</> : <><Mail className="w-4 h-4 mr-2" />E-Mails prüfen</>}
            </Button>
          </div>
        )}
      </div>

      {/* Postfach-Status */}
      {!email.verbunden ? (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <Mail className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">E-Mail-Postfach ist nicht verbunden</p>
            <p className="mt-0.5">Rechnungen, die per E-Mail kommen, werden erst automatisch hier abgelegt, wenn das Postfach verbunden ist.{' '}
              {isAdmin
                ? <Link href="/einstellungen" className="underline font-medium">Jetzt unter Einstellungen verbinden</Link>
                : 'Bitte einen Administrator bitten, es unter Einstellungen zu verbinden.'}
            </p>
          </div>
        </div>
      ) : email.fehler ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-900">
            <p className="font-medium">E-Mail-Abruf unterbrochen</p>
            <p className="mt-0.5">{email.fehler}{' '}
              {isAdmin && <Link href="/einstellungen" className="underline font-medium">Zu den Einstellungen</Link>}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          {syncing && syncStill && <Loader2 className="w-3 h-3 animate-spin" />}
          {syncing && syncStill ? 'Postfach wird geprüft…' : `Postfach ${email.adresse || ''} verbunden${email.letzterSync ? ` · letzter Abruf ${new Date(email.letzterSync).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}${email.aktiv ? '' : ' · automatischer Abruf aus'}`}
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="card-hover">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Gesamt</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{rechnungen.length}</p>
          </CardContent>
        </Card>
        <Card className={cn('card-hover', ueberfaellig.length > 0 && 'border-red-300 bg-red-50/40')}>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
              {ueberfaellig.length > 0 && <AlertTriangle className="w-3 h-3 text-red-500" />} Überfällig
            </p>
            <p className={cn('text-2xl font-bold mt-1', ueberfaellig.length > 0 ? 'text-red-600 status-pulse' : 'text-slate-900')}>{ueberfaellig.length}</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Offen</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{euro(offenBetrag)}</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Einkauf gesamt</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{euro(gesamtBetrag)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Upload */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
          dragOver ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/30',
          uploading && 'pointer-events-none opacity-70'
        )}
      >
        <input ref={inputRef} type="file" multiple accept="application/pdf,image/*" className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="font-medium text-slate-700">Rechnung wird ausgelesen…</p>
            <p className="text-xs text-slate-400">{uploadInfo}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-slate-300" />
            <p className="font-medium text-slate-700">Rechnungen hochladen</p>
            <p className="text-xs text-slate-400">PDF oder Foto, auch mehrere auf einmal — wird automatisch ausgelesen und hier abgelegt</p>
          </div>
        )}
      </div>

      {/* Feedback */}
      {erfolg && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800 whitespace-pre-wrap">{erfolg}</p>
          <button onClick={() => setErfolg(null)} className="ml-auto"><X className="w-4 h-4 text-green-600" /></button>
        </div>
      )}
      {fehler && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 whitespace-pre-wrap">{fehler}</p>
          <button onClick={() => setFehler(null)} className="ml-auto"><X className="w-4 h-4 text-red-600" /></button>
        </div>
      )}

      {/* Filter + Suche */}
      <div className="flex gap-2 flex-wrap items-center">
        {([
          ['alle', `Alle (${rechnungen.length})`],
          ['offen', `Offen (${offene.length})`],
          ['bezahlt', `Bezahlt (${rechnungen.length - offene.length})`],
          ...(zuPruefen.length > 0 ? [['pruefen', `Zu prüfen (${zuPruefen.length})`]] : []),
        ] as [typeof filter, string][]).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              filter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            )}>
            {label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Lieferant, Nummer, Betrag…"
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
        </div>
      </div>

      {/* Liste */}
      {gefiltert.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="text-slate-500">{rechnungen.length === 0 ? 'Noch keine Rechnungen' : 'Keine Rechnungen gefunden'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {gefiltert.map(r => {
            const open = expandedId === r.id
            const ueberfaelligR = !r.bezahlt && !!r.faellig_am && r.faellig_am < heute
            const bearbeitet = edit?.id === r.id
            return (
              <div key={r.id} className={cn('bg-white border rounded-xl overflow-hidden transition-all',
                ueberfaelligR ? 'border-red-300' : r.bezahlt ? 'border-green-200' : 'border-slate-200'
              )}>
                <div className="flex items-center gap-3 px-4 py-3.5 flex-wrap sm:flex-nowrap">
                  {/* Status: eindeutig Offen | Bezahlt */}
                  <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 text-xs font-medium" role="group" aria-label="Zahlstatus">
                    <button onClick={() => setzeStatus(r, false)} title="Als offen markieren"
                      className={cn('px-2.5 py-1.5 transition-colors',
                        !r.bezahlt ? (ueberfaelligR ? 'bg-red-500 text-white' : 'bg-amber-400 text-white') : 'bg-white text-slate-400 hover:bg-slate-50')}>
                      Offen
                    </button>
                    <button onClick={() => setzeStatus(r, true)} title="Als bezahlt markieren"
                      className={cn('px-2.5 py-1.5 border-l border-slate-200 transition-colors',
                        r.bezahlt ? 'bg-green-500 text-white' : 'bg-white text-slate-400 hover:bg-green-50 hover:text-green-700')}>
                      Bezahlt
                    </button>
                  </div>

                  {/* Klickbare Zeile — kein Button-in-Button */}
                  <div onClick={() => setExpandedId(open ? null : r.id)} className="flex-1 flex items-center gap-3 cursor-pointer min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 text-sm truncate">{r.lieferant ?? 'Unbekannter Lieferant'}</p>
                        {ueberfaelligR && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium status-pulse">Überfällig</span>}
                        {r.bezahlt && r.bezahlt_am && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">bezahlt am {fmt(r.bezahlt_am)}</span>}
                        {r.pruefen && <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-medium" title="Die automatische Auslesung war unsicher – bitte Daten kontrollieren">Bitte prüfen</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {r.rechnungsnummer && <span className="font-mono mr-2">{r.rechnungsnummer}</span>}
                        {r.datum && <span>{fmt(r.datum)}</span>}
                        {r.faellig_am && !r.bezahlt && <span className={cn('ml-2', ueberfaelligR ? 'text-red-600 font-medium' : 'text-slate-400')}>· fällig {fmt(r.faellig_am)}</span>}
                        {r.quelle === 'email' && <span className="ml-2 text-slate-400">· per E-Mail</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {r.gesamt != null && (
                        <p className={cn('font-bold text-sm', r.bezahlt ? 'text-green-600' : ueberfaelligR ? 'text-red-600' : 'text-slate-900')}>
                          {euro(r.gesamt)}
                        </p>
                      )}
                      {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* PDF direkt aus der Liste */}
                  {r.datei_pfad ? (
                    <a href={`/api/rechnung-import/datei?id=${r.id}`} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-600 hover:text-orange-600 hover:bg-orange-50 transition-colors flex-shrink-0" title="PDF ansehen">
                      <FileText className="w-5 h-5" />
                    </a>
                  ) : (
                    <span className="p-1.5 text-slate-200 flex-shrink-0" title="Keine Datei hinterlegt"><FileText className="w-5 h-5" /></span>
                  )}
                </div>

                {open && (
                  <div className="border-t border-slate-100">
                    {/* Rechnungsdetails */}
                    {bearbeitet && edit ? (
                      <div className="px-5 py-4 bg-slate-50 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="text-xs text-slate-500">Lieferant
                            <input value={edit.lieferant} onChange={e => setEdit({ ...edit, lieferant: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
                          </label>
                          <label className="text-xs text-slate-500">Rechnungs-Nr.
                            <input value={edit.rechnungsnummer} onChange={e => setEdit({ ...edit, rechnungsnummer: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white font-mono" />
                          </label>
                          <label className="text-xs text-slate-500">Rechnungsdatum
                            <input type="date" value={edit.datum} onChange={e => setEdit({ ...edit, datum: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
                          </label>
                          <label className="text-xs text-slate-500">Fällig am
                            <input type="date" value={edit.faellig_am} onChange={e => setEdit({ ...edit, faellig_am: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
                          </label>
                          <label className="text-xs text-slate-500">Gesamtbetrag brutto (€)
                            <DecimalField value={edit.gesamt} onChange={n => setEdit({ ...edit, gesamt: n })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
                          </label>
                          {r.bezahlt && (
                            <label className="text-xs text-slate-500">Bezahlt am
                              <input type="date" value={edit.bezahlt_am} onChange={e => setEdit({ ...edit, bezahlt_am: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
                            </label>
                          )}
                        </div>
                        <label className="text-xs text-slate-500 block">Notiz
                          <input value={edit.notizen} onChange={e => setEdit({ ...edit, notizen: e.target.value })} placeholder="z. B. Teile für Golf RW-260010" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
                        </label>
                        <div className="flex gap-2">
                          <Button onClick={() => bearbeitenSpeichern(r)} disabled={speichert}>
                            {speichert ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Speichern
                          </Button>
                          <button onClick={() => setEdit(null)} disabled={speichert} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-white">Abbrechen</button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-4 bg-slate-50 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Lieferant</p>
                            <p className="text-sm font-medium text-slate-800">{r.lieferant ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Rechnungs-Nr.</p>
                            <p className="text-sm font-mono text-slate-800">{r.rechnungsnummer ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Rechnungsdatum</p>
                            <p className="text-sm text-slate-800">{fmt(r.datum) ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Fällig am</p>
                            <p className={cn('text-sm font-medium', ueberfaelligR ? 'text-red-600' : 'text-slate-800')}>{fmt(r.faellig_am) ?? '—'}</p>
                          </div>
                        </div>
                        {r.notizen && <p className="text-sm text-slate-600">📝 {r.notizen}</p>}
                        {r.quelle === 'email' && (r.absender_email || r.email_betreff) && (
                          <p className="text-xs text-slate-500 flex items-start gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                              Per E-Mail{r.absender_email ? ` von ${r.absender_email}` : ''}{r.email_empfangen_am ? `, empfangen ${fmt(r.email_empfangen_am)}` : ''}
                              {r.email_betreff ? ` — „${r.email_betreff}“` : ''}
                              {r.email_link && <> · <a href={r.email_link} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">in Outlook öffnen<ExternalLink className="w-3 h-3" /></a></>}
                            </span>
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {r.datei_pfad ? (
                            <>
                              <a href={`/api/rechnung-import/datei?id=${r.id}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-700">
                                <FileText className="w-3.5 h-3.5" /> PDF ansehen
                              </a>
                              <a href={`/api/rechnung-import/datei?id=${r.id}&download=1`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50">
                                <Download className="w-3.5 h-3.5" /> Herunterladen
                              </a>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 self-center">Keine Datei hinterlegt</span>
                          )}
                          <button onClick={() => bearbeitenStarten(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50">
                            <Pencil className="w-3.5 h-3.5" /> Bearbeiten
                          </button>
                          <button onClick={() => setLoeschenId(r.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-600 hover:bg-red-50 sm:ml-auto">
                            <Trash2 className="w-3.5 h-3.5" /> Löschen
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Positionen */}
                    {r.positionen.length > 0 ? (
                      <div className="border-t border-slate-100">
                        <div className="divide-y divide-slate-50">
                          {r.positionen.map(p => (
                            <div key={p.id} className="px-4 py-3 flex items-start gap-3">
                              <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-800 font-medium">{p.bezeichnung}</p>
                                {p.teilenummer && <p className="text-xs font-mono text-slate-400 mt-0.5">{p.teilenummer}</p>}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-semibold text-slate-900">
                                  {p.gesamtpreis != null ? euro(p.gesamtpreis) : p.einzelpreis != null ? euro(p.einzelpreis) : '—'}
                                </p>
                                <p className="text-xs text-slate-400">{p.menge}x {p.einzelpreis != null ? euro(p.einzelpreis) : ''}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">Gesamt (brutto)</span>
                          <span className="text-sm font-bold text-orange-600">{r.gesamt != null ? euro(r.gesamt) : '—'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-4 flex items-center gap-2 text-slate-400 text-sm border-t border-slate-100">
                        <Package className="w-4 h-4" />
                        <span>Keine Einzelpositionen erkannt</span>
                        {r.gesamt != null && <span className="ml-auto font-semibold text-slate-700">{euro(r.gesamt)} gesamt</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Löschen-Bestätigung */}
      {loeschenId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Rechnung löschen?</p>
                <p className="text-sm text-slate-500">Die Rechnung und die abgelegte PDF werden entfernt. Das kann nicht rückgängig gemacht werden.</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setLoeschenId(null)} disabled={loeschend}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                Abbrechen
              </button>
              <button onClick={() => loeschenBestaetigen(loeschenId)} disabled={loeschend}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loeschend ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {loeschend ? 'Wird gelöscht…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
