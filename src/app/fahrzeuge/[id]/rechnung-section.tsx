'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Printer, Trash2, Archive, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  auftragId: string
  betriebId: string
  fahrzeugId?: string
}

interface OffenerPosten {
  id: string
  nummer: string
  summe: number
}

export function RechnungSection({ auftragId, betriebId, fahrzeugId }: Props) {
  const [rechnungen, setRechnungen] = useState<any[]>([])
  const [offeneKvs, setOffeneKvs] = useState<OffenerPosten[]>([])
  const [offeneWas, setOffeneWas] = useState<OffenerPosten[]>([])
  const [selectedKvIds, setSelectedKvIds] = useState<Set<string>>(new Set())
  const [selectedWaIds, setSelectedWaIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [loeschenId, setLoeschenId] = useState<string | null>(null)
  const [loesching, setLoesching] = useState(false)
  const [stornierend, setStornierend] = useState(false)
  const [archivZeigen, setArchivZeigen] = useState(false)

  useEffect(() => {
    loadData()
  }, [auftragId])

  const loadData = async () => {
    setDataLoading(true)
    try {
      const supabase = await createClient()

      const [{ data: rechnungenData }, { data: kvRows }, { data: waRows }] = await Promise.all([
        supabase
          .from('kunden_rechnungen')
          .select('*')
          .eq('auftrag_id', auftragId)
          .eq('betrieb_id', betriebId)
          .order('erstellt_am', { ascending: false }),
        supabase
          .from('kostenvoranschlaege')
          .select('id, nummer, ersatzteile_modus, ersatzteile_festpreis, positionen:kostenvoranschlag_position(gesamtpreis)')
          .eq('auftrag_id', auftragId)
          .eq('betrieb_id', betriebId)
          .is('rechnung_id', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('werkstattauftraege')
          .select('id, nummer, positionen:werkstattauftrag_positionen(gesamtpreis)')
          .eq('auftrag_id', auftragId)
          .eq('betrieb_id', betriebId)
          .is('rechnung_id', null)
          .order('created_at', { ascending: false }),
      ])

      const kvs: OffenerPosten[] = (kvRows || []).map((kv: any) => ({
        id: kv.id,
        nummer: kv.nummer,
        summe: kv.ersatzteile_modus === 'festpreis'
          ? (kv.ersatzteile_festpreis || 0)
          : (kv.positionen || []).reduce((s: number, p: any) => s + (p.gesamtpreis || 0), 0),
      }))
      const was: OffenerPosten[] = (waRows || []).map((wa: any) => ({
        id: wa.id,
        nummer: wa.nummer,
        summe: (wa.positionen || []).reduce((s: number, p: any) => s + (p.gesamtpreis || 0), 0),
      }))

      setRechnungen(rechnungenData || [])
      setOffeneKvs(kvs)
      setOffeneWas(was)
      // Standardmäßig alle offenen Posten vorauswählen
      setSelectedKvIds(new Set(kvs.map(k => k.id)))
      setSelectedWaIds(new Set(was.map(w => w.id)))
    } catch (error) {
      console.error('[Rechnung Load] Error:', error)
    } finally {
      setDataLoading(false)
    }
  }

  const toggleKv = (id: string) => {
    setSelectedKvIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleWa = (id: string) => {
    setSelectedWaIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const auswahlSumme =
    offeneKvs.filter(k => selectedKvIds.has(k.id)).reduce((s, k) => s + k.summe, 0) +
    offeneWas.filter(w => selectedWaIds.has(w.id)).reduce((s, w) => s + w.summe, 0)

  const handleCreate = async () => {
    if (selectedKvIds.size === 0 && selectedWaIds.size === 0) {
      alert('Bitte mindestens einen Kostenvoranschlag oder Werkstattauftrag auswählen')
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/rechnung/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auftragId,
          betriebId,
          fahrzeugId,
          kostenvoranschlagIds: Array.from(selectedKvIds),
          werkstattauftragIds: Array.from(selectedWaIds),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        alert(`Fehler: ${data.error}`)
        return
      }
      if (data.erfolg) {
        await loadData()
      }
    } catch (error) {
      console.error('[Rechnung Create] Error:', error)
      alert('Fehler beim Erstellen der Rechnung')
    } finally {
      setLoading(false)
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
  const hatOffenePosten = offeneKvs.length > 0 || offeneWas.length > 0

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
              <div key={rechnung.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">{rechnung.rechnungs_nr}</p>
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

        {/* Offene Posten zur Auswahl */}
        {dataLoading ? (
          <p className="text-sm text-slate-500">Wird geladen...</p>
        ) : hatOffenePosten ? (
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">Noch nicht abgerechnet – für neue Rechnung auswählen:</p>

            {offeneKvs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500 uppercase">Kostenvoranschläge</p>
                {offeneKvs.map(kv => (
                  <label key={kv.id} className="flex items-center justify-between p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100">
                    <span className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedKvIds.has(kv.id)}
                        onChange={() => toggleKv(kv.id)}
                        className="w-4 h-4"
                      />
                      {kv.nummer}
                    </span>
                    <span className="text-sm font-medium">{kv.summe.toFixed(2)} €</span>
                  </label>
                ))}
              </div>
            )}

            {offeneWas.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500 uppercase">Werkstattaufträge</p>
                {offeneWas.map(wa => (
                  <label key={wa.id} className="flex items-center justify-between p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100">
                    <span className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedWaIds.has(wa.id)}
                        onChange={() => toggleWa(wa.id)}
                        className="w-4 h-4"
                      />
                      {wa.nummer}
                    </span>
                    <span className="text-sm font-medium">{wa.summe.toFixed(2)} €</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-slate-600">Ausgewählt (netto): <strong>{auswahlSumme.toFixed(2)} €</strong></span>
              <Button onClick={handleCreate} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                {loading ? 'Wird erstellt...' : 'Rechnung erstellen'}
              </Button>
            </div>
          </div>
        ) : rechnungen.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Keine Kostenvoranschläge oder Werkstattaufträge zum Abrechnen vorhanden</p>
        ) : (
          <p className="text-sm text-slate-500 text-center py-2">Alle Positionen dieses Auftrags sind bereits abgerechnet</p>
        )}
      </CardContent>
    </Card>
  )
}
