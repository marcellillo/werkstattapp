'use client'
import { useState, useRef, useEffect } from 'react'
import { Receipt, Upload, X, ChevronDown, ChevronUp, Package, Loader2, CheckCircle, AlertCircle, Mail, AlertTriangle, Euro, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  positionen: Position[]
}

function fmt(d?: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function RechnungenContent({ rechnungen: initial, isAdmin = false }: { rechnungen: Rechnung[]; isAdmin?: boolean }) {
  const [rechnungen, setRechnungen] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [erfolg, setErfolg] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [filter, setFilter] = useState<'alle' | 'offen' | 'bezahlt'>('alle')
  const [loeschenId, setLoeschenId] = useState<string | null>(null)
  const [loesching, setLoesching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Auto-Sync alle 30 Minuten wenn die Seite offen ist
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/email-sync', { method: 'POST' })
        const data = await res.json()
        if (data.rechnungenImportiert > 0) {
          const res2 = await fetch('/api/rechnung-import/list')
          if (res2.ok) { const { rechnungen: neu } = await res2.json(); setRechnungen(neu) }
        }
      } catch { /* still fehlgeschlagen, ignorieren */ }
    }, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function loeschenBestaetigen(id: string) {
    setLoesching(true)
    setFehler(null)
    const { error: e1 } = await supabase.from('rechnung_positionen').delete().eq('rechnung_id', id)
    if (e1) { setFehler(`Positionen: ${e1.message}`); setLoesching(false); return }
    const { error: e2 } = await supabase.from('rechnungen').delete().eq('id', id)
    if (e2) { setFehler(`Rechnung: ${e2.message}`); setLoesching(false); return }
    setRechnungen(prev => prev.filter(r => r.id !== id))
    setLoeschenId(null)
    setLoesching(false)
    setExpandedId(null)
  }

  async function toggleBezahlt(r: Rechnung) {
    const neuBezahlt = !r.bezahlt
    const heute = new Date().toISOString().split('T')[0]
    setRechnungen(prev => prev.map(x => x.id === r.id
      ? { ...x, bezahlt: neuBezahlt, bezahlt_am: neuBezahlt ? heute : null }
      : x
    ))
    await supabase.from('rechnungen').update({
      bezahlt: neuBezahlt,
      bezahlt_am: neuBezahlt ? heute : null,
    }).eq('id', r.id)
  }

  async function emailSync() {
    setSyncing(true); setFehler(null); setErfolg(null)
    try {
      const res = await fetch('/api/email-sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.erfolg) { setFehler(data.error ?? 'Sync fehlgeschlagen'); return }

      const teile = data.statusAktualisiert ?? 0
      const rech = data.rechnungenImportiert ?? 0
      if (rech > 0) {
        const res2 = await fetch('/api/rechnung-import/list')
        if (res2.ok) { const { rechnungen: neu } = await res2.json(); setRechnungen(neu) }
      }
      const teile_str = teile > 0 ? `, ${teile} Teile aktualisiert` : ''
      const rech_str = rech > 0 ? `${rech} Rechnung${rech !== 1 ? 'en' : ''} importiert` : 'Keine neuen Rechnungen'
      const duplikate_str = data.duplikate > 0 ? ` (${data.duplikate} Duplikate übersprungen)` : ''
      let msg = `${data.emailsGeprueft} E-Mails geprüft — ${rech_str}${teile_str}${duplikate_str}`
      if (data.fehler?.length > 0) msg += `\n⚠️ ${data.fehler.join('\n⚠️ ')}`
      setErfolg(msg)
    } catch (e: any) { setFehler(e.message) }
    finally { setSyncing(false) }
  }

  async function uploadRechnung(file: File) {
    setUploading(true); setFehler(null); setErfolg(null)
    const fd = new FormData(); fd.append('datei', file)
    try {
      const res = await fetch('/api/rechnung-import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.erfolg) { setFehler(data.error ?? 'Fehler beim Import'); return }
      const res2 = await fetch('/api/rechnung-import/list')
      if (res2.ok) { const { rechnungen: neu } = await res2.json(); setRechnungen(neu) }
      else window.location.reload()
      setErfolg(`Rechnung von ${data.extrakt.lieferant ?? 'Unbekannt'} importiert`)
      setExpandedId(data.rechnungId)
    } catch (e: any) { setFehler(e.message) }
    finally { setUploading(false) }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const file = files[0]
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) { setFehler('Nur PDF oder Bilder erlaubt'); return }
    uploadRechnung(file)
  }

  const heute = new Date().toISOString().split('T')[0]
  const gefiltert = rechnungen.filter(r =>
    filter === 'offen' ? !r.bezahlt :
    filter === 'bezahlt' ? r.bezahlt : true
  )
  const offene = rechnungen.filter(r => !r.bezahlt)
  const ueberfaellig = offene.filter(r => r.faellig_am && r.faellig_am < heute)
  const offenBetrag = offene.reduce((s, r) => s + (r.gesamt ?? 0), 0)
  const gesamtBetrag = rechnungen.reduce((s, r) => s + (r.gesamt ?? 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lieferantenrechnungen</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rechnungen.length} Rechnungen · {offene.length} offen</p>
        </div>
        <Button onClick={emailSync} disabled={syncing} className="flex-shrink-0">
          {syncing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Prüfe…</> : <><Mail className="w-4 h-4 mr-2" />E-Mails prüfen</>}
        </Button>
      </div>

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
            <p className="text-2xl font-bold text-amber-600 mt-1">{offenBetrag.toFixed(2)} €</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Einkauf gesamt</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{gesamtBetrag.toFixed(2)} €</p>
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
        <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => handleFiles(e.target.files)} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="font-medium text-slate-700">Rechnung wird ausgelesen…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-slate-300" />
            <p className="font-medium text-slate-700">Rechnung hochladen</p>
            <p className="text-xs text-slate-400">PDF oder Foto — wird automatisch ausgelesen</p>
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
          <p className="text-sm text-red-800">{fehler}</p>
          <button onClick={() => setFehler(null)} className="ml-auto"><X className="w-4 h-4 text-red-600" /></button>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(['alle', 'offen', 'bezahlt'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              filter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            )}>
            {f === 'alle' ? `Alle (${rechnungen.length})` : f === 'offen' ? `Offen (${offene.length})` : `Bezahlt (${rechnungen.length - offene.length})`}
          </button>
        ))}
      </div>

      {/* Liste */}
      {gefiltert.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="text-slate-500">Keine Rechnungen gefunden</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {gefiltert.map(r => {
            const open = expandedId === r.id
            const ueberfaelligR = !r.bezahlt && r.faellig_am && r.faellig_am < heute
            return (
              <div key={r.id} className={cn('bg-white border rounded-xl overflow-hidden transition-all',
                ueberfaelligR ? 'border-red-300' : r.bezahlt ? 'border-green-200' : 'border-slate-200'
              )}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Bezahlt-Toggle */}
                  <button
                    onClick={() => toggleBezahlt(r)}
                    title={r.bezahlt ? 'Als offen markieren' : 'Als bezahlt markieren'}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                      r.bezahlt
                        ? 'bg-green-500 border-green-500 text-white'
                        : ueberfaelligR
                        ? 'border-red-400 hover:border-red-600'
                        : 'border-slate-300 hover:border-green-400'
                    )}
                  >
                    {r.bezahlt && <CheckCircle className="w-4 h-4" />}
                  </button>

                  {/* Klickbare Zeile — kein Button-in-Button */}
                  <div onClick={() => setExpandedId(open ? null : r.id)} className="flex-1 flex items-center gap-3 cursor-pointer min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 text-sm truncate">{r.lieferant ?? 'Unbekannter Lieferant'}</p>
                        {ueberfaelligR && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium status-pulse">Überfällig</span>}
                        {r.bezahlt && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Bezahlt {fmt(r.bezahlt_am) ?? ''}</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {r.rechnungsnummer && <span className="font-mono mr-2">{r.rechnungsnummer}</span>}
                        {r.datum && <span>{fmt(r.datum)}</span>}
                        {r.faellig_am && !r.bezahlt && <span className={cn('ml-2', ueberfaelligR ? 'text-red-600 font-medium' : 'text-slate-400')}>· Fällig {fmt(r.faellig_am)}</span>}
                        <span className="ml-2 text-slate-400">· {r.positionen.length} Positionen</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {r.gesamt != null && (
                        <p className={cn('font-bold text-sm', r.bezahlt ? 'text-green-600' : ueberfaelligR ? 'text-red-600' : 'text-slate-900')}>
                          {r.gesamt.toFixed(2)} €
                        </p>
                      )}
                      {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Löschen-Button */}
                  <button
                    onClick={e => { e.stopPropagation(); setLoeschenId(r.id) }}
                    className="p-1.5 rounded-lg text-slate-900 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                    title="Rechnung löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {open && (
                  <div className="border-t border-slate-100">
                    {/* Rechnungsdetails */}
                    <div className="px-5 py-4 bg-slate-50 grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                        <p className={cn('text-sm font-medium', ueberfaelligR ? 'text-red-600' : 'text-slate-800')}>
                          {fmt(r.faellig_am) ?? '—'}
                        </p>
                      </div>
                    </div>

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
                                  {p.gesamtpreis != null ? `${p.gesamtpreis.toFixed(2)} €` : p.einzelpreis != null ? `${p.einzelpreis.toFixed(2)} €` : '—'}
                                </p>
                                <p className="text-xs text-slate-400">{p.menge}x {p.einzelpreis != null ? `${p.einzelpreis.toFixed(2)} €` : ''}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">Summe</span>
                          <span className="text-sm font-bold text-orange-600">{r.gesamt != null ? `${r.gesamt.toFixed(2)} €` : '—'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-4 flex items-center gap-2 text-slate-400 text-sm border-t border-slate-100">
                        <Package className="w-4 h-4" />
                        <span>Keine Einzelpositionen erkannt</span>
                        {r.gesamt != null && <span className="ml-auto font-semibold text-slate-700">{r.gesamt.toFixed(2)} € gesamt</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Löschen-Bestätigung (nur Admin) */}
      {loeschenId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Rechnung löschen?</p>
                <p className="text-sm text-slate-500">Diese Aktion kann nicht rückgängig gemacht werden.</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setLoeschenId(null)}
                disabled={loesching}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={() => loeschenBestaetigen(loeschenId)}
                disabled={loesching}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loesching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {loesching ? 'Wird gelöscht…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
