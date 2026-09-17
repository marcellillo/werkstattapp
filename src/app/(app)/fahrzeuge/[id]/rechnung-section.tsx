'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Printer, Trash2, Archive, ChevronDown, Pencil, Check, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  auftragId: string
  betriebId: string
  fahrzeugId?: string
}

export function RechnungSection({ auftragId, betriebId }: Props) {
  const [rechnungen, setRechnungen] = useState<any[]>([])
  const [offenePostenAnzahl, setOffenePostenAnzahl] = useState(0)
  const [dataLoading, setDataLoading] = useState(false)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [loeschenId, setLoeschenId] = useState<string | null>(null)
  const [loesching, setLoesching] = useState(false)
  const [stornierend, setStornierend] = useState(false)
  const [archivZeigen, setArchivZeigen] = useState(false)
  const [editingNummerId, setEditingNummerId] = useState<string | null>(null)
  const [nummerEntwurf, setNummerEntwurf] = useState('')
  const [nummerSpeichern, setNummerSpeichern] = useState(false)
  const [nummerFehler, setNummerFehler] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [auftragId])

  // Die Auswahl-/Erstell-Logik (inkl. automatischer Übernahme von Ersatzteilen und
  // Werkstattauftrag) lebt nur noch an einer Stelle: /fahrzeuge/[id]/rechnung
  // (rechnung-flow.tsx). Hier wird nur noch die Historie gezeigt und dorthin verlinkt,
  // damit beide Wege zur Rechnung nicht mehr auseinanderdriften können.
  const loadData = async () => {
    setDataLoading(true)
    try {
      const supabase = await createClient()

      const [{ data: rechnungenData }, { count: kvCount }, { count: waCount }] = await Promise.all([
        supabase
          .from('kunden_rechnungen')
          .select('*')
          .eq('auftrag_id', auftragId)
          .eq('betrieb_id', betriebId)
          .order('erstellt_am', { ascending: false }),
        supabase
          .from('kostenvoranschlaege')
          .select('id', { count: 'exact', head: true })
          .eq('auftrag_id', auftragId)
          .eq('betrieb_id', betriebId)
          .is('rechnung_id', null),
        supabase
          .from('werkstattauftraege')
          .select('id', { count: 'exact', head: true })
          .eq('auftrag_id', auftragId)
          .eq('betrieb_id', betriebId)
          .is('rechnung_id', null),
      ])

      setRechnungen(rechnungenData || [])
      setOffenePostenAnzahl((kvCount || 0) + (waCount || 0))
    } catch (error) {
      console.error('[Rechnung Load] Error:', error)
    } finally {
      setDataLoading(false)
    }
  }

  const handlePrint = async (rechnungId: string) => {
    setPrintingId(rechnungId)
    try {
      const response = await fetch('/api/rechnung/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rechnungId, betriebId }),
      })
      if (!response.ok) throw new Error('PDF-Export fehlgeschlagen')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Rechnung_${rechnungId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('[Rechnung PDF] Error:', error)
      alert('PDF-Export fehlgeschlagen')
    } finally {
      setPrintingId(null)
    }
  }

  const handleDelete = async (rechnungId: string) => {
    setLoesching(true)
    try {
      const response = await fetch('/api/rechnung/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rechnungId, betriebId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Löschen fehlgeschlagen')
      setLoeschenId(null)
      await loadData()
    } catch (error: any) {
      console.error('[Rechnung Delete] Error:', error)
      alert(`Fehler beim Löschen: ${error.message}`)
    } finally {
      setLoesching(false)
    }
  }

  const startNummerEdit = (rechnung: any) => {
    setEditingNummerId(rechnung.id)
    setNummerEntwurf(rechnung.rechnungs_nr)
    setNummerFehler(null)
  }

  const handleNummerSpeichern = async (rechnungId: string) => {
    if (!nummerEntwurf.trim()) { setNummerFehler('Nummer darf nicht leer sein'); return }
    setNummerSpeichern(true)
    setNummerFehler(null)
    try {
      const response = await fetch('/api/rechnung/update-nummer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rechnungId, betriebId, neueNummer: nummerEntwurf }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Speichern fehlgeschlagen')
      setRechnungen(prev => prev.map(r => r.id === rechnungId ? { ...r, rechnungs_nr: data.rechnungs_nr } : r))
      setEditingNummerId(null)
    } catch (error: any) {
      console.error('[Rechnung Nummer] Error:', error)
      setNummerFehler(error.message)
    } finally {
      setNummerSpeichern(false)
    }
  }

  const handleStorno = async (rechnungId: string) => {
    setStornierend(true)
    try {
      const response = await fetch('/api/rechnung/storno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rechnungId, betriebId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Stornieren fehlgeschlagen')
      setLoeschenId(null)
      await loadData()
    } catch (error: any) {
      console.error('[Rechnung Storno] Error:', error)
      alert(`Fehler beim Stornieren: ${error.message}`)
    } finally {
      setStornierend(false)
    }
  }

  const aktiveRechnungen = rechnungen.filter(r => r.status !== 'storniert')
  const stornierteRechnungen = rechnungen.filter(r => r.status === 'storniert')

  return (
    <Card>
      <CardHeader>
        <CardTitle>📄 Rechnungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bestehende (aktive) Rechnungen */}
        {aktiveRechnungen.length > 0 && (
          <div className="space-y-3">
            {aktiveRechnungen.map(rechnung => (
              <div key={rechnung.id} className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {editingNummerId === rechnung.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={nummerEntwurf}
                          onChange={e => setNummerEntwurf(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleNummerSpeichern(rechnung.id); if (e.key === 'Escape') setEditingNummerId(null) }}
                          disabled={nummerSpeichern}
                          autoFocus
                          className="px-2 py-1 border border-slate-300 rounded text-sm font-medium w-40 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button
                          onClick={() => handleNummerSpeichern(rechnung.id)}
                          disabled={nummerSpeichern}
                          className="p-1 text-green-600 hover:bg-green-100 rounded"
                          title="Speichern"
                        >
                          {nummerSpeichern ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingNummerId(null)}
                          disabled={nummerSpeichern}
                          className="p-1 text-slate-500 hover:bg-slate-200 rounded"
                          title="Abbrechen"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <p className="font-medium">{rechnung.rechnungs_nr}</p>
                        <button
                          onClick={() => startNummerEdit(rechnung)}
                          className="p-0.5 text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Rechnungsnummer ändern"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-slate-600">🔧 Werkstatt • {rechnung.status}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <p className="font-semibold mr-2">{(rechnung.betrag_brutto || 0).toFixed(2)} €</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={printingId === rechnung.id}
                      onClick={() => handlePrint(rechnung.id)}
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-800"
                      onClick={() => setLoeschenId(rechnung.id)}
                      title="Rechnung stornieren/löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {editingNummerId === rechnung.id && nummerFehler && (
                  <p className="text-xs text-red-600 mt-1.5">{nummerFehler}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stornierte Rechnungen (Archiv) */}
        {stornierteRechnungen.length > 0 && (
          <div>
            <button
              onClick={() => setArchivZeigen(v => !v)}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
            >
              <Archive className="w-3.5 h-3.5" />
              Storniert ({stornierteRechnungen.length})
              <ChevronDown className={`w-3.5 h-3.5 transition ${archivZeigen ? 'rotate-180' : ''}`} />
            </button>
            {archivZeigen && (
              <div className="space-y-2 mt-2">
                {stornierteRechnungen.map(rechnung => (
                  <div key={rechnung.id} className="flex items-center justify-between p-3 bg-slate-50/60 rounded-lg opacity-70">
                    <div>
                      <p className="font-medium line-through">{rechnung.rechnungs_nr}</p>
                      <p className="text-xs text-slate-500">Storniert</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <p className="font-medium mr-2 text-sm">{(rechnung.betrag_brutto || 0).toFixed(2)} €</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={printingId === rechnung.id}
                        onClick={() => handlePrint(rechnung.id)}
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-800"
                        onClick={() => setLoeschenId(rechnung.id)}
                        title="Endgültig löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loeschenId && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div>
                <p className="font-semibold text-slate-900">Rechnung stornieren oder löschen?</p>
                <p className="text-sm text-slate-500 mt-1">
                  Die verknüpften Kostenvoranschläge/Werkstattaufträge werden in beiden Fällen wieder als "offen" markiert
                  und können in eine neue Rechnung übernommen werden.
                </p>
              </div>
              <div className="space-y-2 pt-1">
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700 justify-start gap-2"
                  disabled={loesching || stornierend}
                  onClick={() => handleStorno(loeschenId)}
                >
                  <Archive className="w-4 h-4" />
                  {stornierend ? 'Wird storniert...' : 'Stornieren (Datensatz bleibt erhalten)'}
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50 justify-start gap-2"
                  disabled={loesching || stornierend}
                  onClick={() => handleDelete(loeschenId)}
                >
                  <Trash2 className="w-4 h-4" />
                  {loesching ? 'Wird gelöscht...' : 'Endgültig löschen'}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  disabled={loesching || stornierend}
                  onClick={() => setLoeschenId(null)}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* CTA zur Rechnungserstellung — eine einzige Implementierung unter /rechnung */}
        {dataLoading ? (
          <p className="text-sm text-slate-500">Wird geladen...</p>
        ) : (
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              {offenePostenAnzahl > 0
                ? `${offenePostenAnzahl} offene Position${offenePostenAnzahl !== 1 ? 'en' : ''} noch nicht abgerechnet`
                : rechnungen.length === 0
                  ? 'Noch keine Rechnung für diesen Auftrag'
                  : 'Alle Positionen sind bereits abgerechnet'}
            </p>
            <Link href={`/fahrzeuge/${auftragId}/rechnung`}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                {offenePostenAnzahl > 0 ? 'Rechnung erstellen' : 'Zur Rechnungserstellung'}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
