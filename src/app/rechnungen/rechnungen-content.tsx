'use client'
import { useState, useRef } from 'react'
import { Receipt, Upload, X, ChevronDown, ChevronUp, Package, Loader2, CheckCircle, AlertCircle, Mail, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  gesamt: number | null
  erstellt_am: string
  positionen: Position[]
}

export function RechnungenContent({ rechnungen: initial }: { rechnungen: Rechnung[] }) {
  const [rechnungen, setRechnungen] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [erfolg, setErfolg] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function emailSync() {
    setSyncing(true)
    setFehler(null)
    setErfolg(null)
    try {
      const res = await fetch('/api/email-sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.erfolg) {
        setFehler(data.error ?? 'Sync fehlgeschlagen')
        return
      }
      if (data.rechnungenImportiert > 0) {
        // Neu laden
        const res2 = await fetch('/api/rechnung-import/list')
        if (res2.ok) {
          const { rechnungen: neu } = await res2.json()
          setRechnungen(neu)
        }
        setErfolg(`${data.rechnungenImportiert} Rechnung${data.rechnungenImportiert !== 1 ? 'en' : ''} aus ${data.emailsGeprueft} E-Mails importiert.`)
      } else {
        setErfolg(`${data.emailsGeprueft} E-Mails geprüft — keine neuen Rechnungen gefunden.`)
      }
    } catch (e: any) {
      setFehler(e.message)
    } finally {
      setSyncing(false)
    }
  }

  async function uploadRechnung(file: File) {
    setUploading(true)
    setFehler(null)
    setErfolg(null)

    const fd = new FormData()
    fd.append('datei', file)

    try {
      const res = await fetch('/api/rechnung-import', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok || !data.erfolg) {
        setFehler(data.error ?? 'Unbekannter Fehler')
        return
      }

      // Neu laden
      const res2 = await fetch('/api/rechnung-import/list')
      if (res2.ok) {
        const { rechnungen: neu } = await res2.json()
        setRechnungen(neu)
      } else {
        // Fallback: Seite neu laden
        window.location.reload()
        return
      }

      setErfolg(`Rechnung von ${data.extrakt.lieferant ?? 'Unbekannt'} erfolgreich importiert (${data.extrakt.positionen?.length ?? 0} Positionen)`)
      setExpandedId(data.rechnungId)
    } catch (e: any) {
      setFehler(e.message)
    } finally {
      setUploading(false)
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const file = files[0]
    const ok = file.type === 'application/pdf' || file.type.startsWith('image/')
    if (!ok) { setFehler('Nur PDF oder Bilder erlaubt'); return }
    uploadRechnung(file)
  }

  const gesamtGekauft = rechnungen.reduce((s, r) => s + (r.gesamt ?? 0), 0)
  const anzahlPositionen = rechnungen.reduce((s, r) => s + r.positionen.length, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lieferantenrechnungen</h1>
          <p className="text-sm text-gray-500 mt-0.5">{rechnungen.length} Rechnungen · {anzahlPositionen} Positionen gesamt</p>
        </div>
        <Button
          onClick={emailSync}
          disabled={syncing}
          className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
        >
          {syncing
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Syncing…</>
            : <><Mail className="w-4 h-4 mr-2" />E-Mails sync</>
          }
        </Button>
      </div>

      {/* KPI-Zeile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Rechnungen</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{rechnungen.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Teile eingekauft</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{anzahlPositionen}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Einkaufswert gesamt</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{gesamtGekauft.toFixed(2)} €</p>
          </CardContent>
        </Card>
      </div>

      {/* Upload-Bereich */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
          dragOver ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/30',
          uploading && 'pointer-events-none opacity-70'
        )}
      >
        <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => handleFiles(e.target.files)} />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            <p className="font-medium text-gray-700">Claude liest die Rechnung aus…</p>
            <p className="text-sm text-gray-500">Das kann 10–30 Sekunden dauern</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-gray-300" />
            <div>
              <p className="font-medium text-gray-700">Rechnung hochladen</p>
              <p className="text-sm text-gray-500 mt-1">PDF oder Foto hierher ziehen, oder klicken zum Auswählen</p>
            </div>
            <p className="text-xs text-gray-400">Claude extrahiert automatisch Teile, Mengen und Preise</p>
          </div>
        )}
      </div>

      {/* Feedback */}
      {erfolg && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{erfolg}</p>
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

      {/* Rechnungsliste */}
      {rechnungen.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Noch keine Rechnungen importiert</p>
            <p className="text-sm text-gray-400 mt-1">Lade eine Rechnung hoch um zu starten</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rechnungen.map(r => {
            const open = expandedId === r.id
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(open ? null : r.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{r.lieferant ?? 'Unbekannter Lieferant'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.rechnungsnummer && <span className="font-mono mr-2">{r.rechnungsnummer}</span>}
                      {r.datum && <span>{new Date(r.datum).toLocaleDateString('de-DE')}</span>}
                      <span className="ml-2 text-gray-400">· {r.positionen.length} Positionen</span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {r.gesamt != null && (
                      <p className="font-bold text-gray-900">{r.gesamt.toFixed(2)} €</p>
                    )}
                  </div>
                  {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>

                {/* Positionen */}
                {open && r.positionen.length > 0 && (
                  <div className="border-t border-gray-100">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2.5">Bezeichnung</th>
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5 hidden sm:table-cell">Teilenummer</th>
                            <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5">Menge</th>
                            <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5">Einzelpreis</th>
                            <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2.5">Gesamt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {r.positionen.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50/50">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-800">{p.bezeichnung}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <span className="text-xs font-mono text-gray-500">{p.teilenummer ?? '—'}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm text-gray-700">{p.menge}x</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm text-gray-700">{p.einzelpreis != null ? `${p.einzelpreis.toFixed(2)} €` : '—'}</span>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <span className="text-sm font-medium text-gray-900">
                                  {p.gesamtpreis != null ? `${p.gesamtpreis.toFixed(2)} €` : '—'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200 bg-gray-50">
                            <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-gray-700 text-right">Summe</td>
                            <td className="px-5 py-3 text-right">
                              <span className="text-sm font-bold text-orange-600">
                                {r.gesamt != null ? `${r.gesamt.toFixed(2)} €` : '—'}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
