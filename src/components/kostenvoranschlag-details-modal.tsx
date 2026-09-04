'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Save, Upload, Printer, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LieferscheinScanner } from './lieferschein-scanner'
import { LieferscheinGalerie } from './lieferschein-galerie'
import { TeileErfassungTabs } from './teile-erfassung-tabs'

interface Position {
  id?: string
  beschreibung: string
  menge: number
  einzelpreis: number
  gesamtpreis: number
}

interface Props {
  kostenvoranschlagId: string
  betriebId: string
  fahrzeugId?: string
  auftragId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KostenvoranschlagDetailsModal({ kostenvoranschlagId, betriebId, fahrzeugId, auftragId, open, onOpenChange }: Props) {
  const [kv, setKv] = useState<any>(null)
  const [positionen, setPositionen] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newPosition, setNewPosition] = useState<Position>({ beschreibung: '', menge: 1, einzelpreis: 0, gesamtpreis: 0 })
  const [showScanner, setShowScanner] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [galerieRefresh, setGalerieRefresh] = useState(0)

  useEffect(() => {
    if (open) {
      loadKostenvoranschlag()
    }
  }, [open, kostenvoranschlagId])

  const loadKostenvoranschlag = async () => {
    setLoading(true)
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('kostenvoranschlaege')
        .select(`
          *,
          positionen:kostenvoranschlag_position(*),
          fahrzeug:fahrzeuge(*),
          kunde:kunden(*)
        `)
        .eq('id', kostenvoranschlagId)
        .eq('betrieb_id', betriebId)
        .single()

      if (error) throw error
      setKv(data)
      setPositionen(data.positionen || [])
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPosition = () => {
    if (newPosition.beschreibung.trim()) {
      const gesamtpreis = newPosition.menge * newPosition.einzelpreis
      setPositionen([...positionen, { ...newPosition, gesamtpreis }])
      setNewPosition({ beschreibung: '', menge: 1, einzelpreis: 0, gesamtpreis: 0 })
    }
  }

  const handleRemovePosition = (index: number) => {
    setPositionen(positionen.filter((_, i) => i !== index))
  }

  const handleUpdatePosition = (index: number, field: string, value: any) => {
    const updated = [...positionen]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'menge' || field === 'einzelpreis') {
      updated[index].gesamtpreis = updated[index].menge * updated[index].einzelpreis
    }
    setPositionen(updated)
  }

  const calculateTotals = () => {
    const summeNetto = positionen.reduce((sum, pos) => sum + (pos.gesamtpreis || 0), 0)
    const mwst = summeNetto * 0.19
    return { summeNetto, mwst, summeBrutto: summeNetto + mwst }
  }

  const handleSave = async () => {
    if (!kv) return
    setSaving(true)
    try {
      const supabase = await createClient()

      // Speichere Positionen
      for (const pos of positionen) {
        if (pos.id) {
          // Update existing
          await supabase
            .from('kostenvoranschlag_position')
            .update({
              beschreibung: pos.beschreibung,
              menge: pos.menge,
              einzelpreis: pos.einzelpreis,
              gesamtpreis: pos.gesamtpreis,
            })
            .eq('id', pos.id)
        } else {
          // Insert new
          await supabase
            .from('kostenvoranschlag_position')
            .insert({
              kostenvoranschlag_id: kostenvoranschlagId,
              betrieb_id: betriebId,
              beschreibung: pos.beschreibung,
              menge: pos.menge,
              einzelpreis: pos.einzelpreis,
              gesamtpreis: pos.gesamtpreis,
            })
        }
      }

      // Update status
      await supabase
        .from('kostenvoranschlaege')
        .update({ status: kv.status })
        .eq('id', kostenvoranschlagId)

      alert('Kostenvoranschlag gespeichert!')
      onOpenChange(false)
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const totals = calculateTotals()

  const handlePrint = async () => {
    if (!kv) return
    setPrinting(true)
    try {
      const supabase = await createClient()
      const { data: config } = await supabase.from('betrieb_config').select('firma_logo').eq('betrieb_id', betriebId).single()

      const pdfData = {
        betriebName: 'Werkstatt Manager',
        betriebAdresse: 'Adresse',
        betriebTel: 'Tel',
        logoBase64: config?.firma_logo || '',
        kvaNummer: kv.id.slice(0, 8).toUpperCase(),
        datum: new Date().toLocaleDateString('de-DE'),
        gueltigBis: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE'),
        fahrzeugMarke: kv.fahrzeug?.marke || '',
        fahrzeugModell: kv.fahrzeug?.modell || '',
        fahrzeugKennzeichen: kv.fahrzeug?.kennzeichen || '',
        fahrzeugFin: kv.fahrzeug?.fin || '',
        kundeName: kv.kunde ? `${kv.kunde.vorname || ''} ${kv.kunde.nachname || ''}`.trim() : '',
        kundeAdresse: kv.kunde?.strasse || '',
        kundeOrt: `${kv.kunde?.plz || ''} ${kv.kunde?.ort || ''}`.trim(),
        positionen: positionen.map(p => ({
          beschreibung: p.beschreibung,
          menge: p.menge,
          preis: (p.einzelpreis || 0).toFixed(2),
          summe: (p.gesamtpreis || 0).toFixed(2),
        })),
        summeNetto: totals.summeNetto.toFixed(2),
        mwst: totals.mwst.toFixed(2),
        summeBrutto: totals.summeBrutto.toFixed(2),
        gueltigkeitsTage: '30',
      }

      const res = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'kostenvoranschlag', data: pdfData }),
      })

      if (!res.ok) throw new Error('PDF-Fehler')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `KVA-${pdfData.kvaNummer}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Print error:', error)
      alert('Fehler beim Drucken')
    } finally {
      setPrinting(false)
    }
  }

  if (!kv) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kostenvoranschlag {kv.nummer}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Wird geladen...</div>
        ) : (
          <div className="space-y-6">
            {/* Teile Erfassung - mit oder ohne Tabs */}
            {fahrzeugId && auftragId ? (
              <TeileErfassungTabs
                betriebId={betriebId}
                fahrzeugId={fahrzeugId}
                kostenvoranschlagId={kostenvoranschlagId}
                auftragId={auftragId}
                onSuccess={() => loadKostenvoranschlag()}
              />
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Lieferschein einscannen</h3>
                <LieferscheinGalerie kostenvoranschlagId={kostenvoranschlagId} refreshSignal={galerieRefresh} />
                <LieferscheinScanner
                  betriebId={betriebId}
                  kostenvoranschlag_id={kostenvoranschlagId}
                  auftragId={auftragId}
                  onSuccess={() => {
                    setGalerieRefresh(s => s + 1)
                    loadKostenvoranschlag()
                  }}
                />
              </div>
            )}

            {/* Status */}
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={kv.status || 'entwurf'}
                onChange={(e) => setKv({ ...kv, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="entwurf">Entwurf</option>
                <option value="versendet">Versendet</option>
                <option value="akzeptiert">Akzeptiert</option>
                <option value="abgelehnt">Abgelehnt</option>
              </select>
            </div>

            {/* Positionen */}
            <div>
              <h3 className="font-medium mb-3">Positionen</h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Beschreibung</th>
                    <th className="text-right py-2 w-20">Menge</th>
                    <th className="text-right py-2 w-24">Preis (€)</th>
                    <th className="text-right py-2 w-24">Summe (€)</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {positionen.map((pos, idx) => (
                    <tr key={idx} className="border-b hover:bg-slate-50">
                      <td className="py-2">
                        <input
                          type="text"
                          value={pos.beschreibung}
                          onChange={(e) => handleUpdatePosition(idx, 'beschreibung', e.target.value)}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          value={pos.menge}
                          onChange={(e) => handleUpdatePosition(idx, 'menge', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border rounded text-right"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          value={pos.einzelpreis}
                          onChange={(e) => handleUpdatePosition(idx, 'einzelpreis', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border rounded text-right"
                          step="0.01"
                        />
                      </td>
                      <td className="py-2 text-right pr-2">{(pos.gesamtpreis || 0).toFixed(2)}</td>
                      <td className="py-2">
                        <button
                          onClick={() => handleRemovePosition(idx)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Neue Position */}
              <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    placeholder="Beschreibung"
                    value={newPosition.beschreibung}
                    onChange={(e) => setNewPosition({ ...newPosition, beschreibung: e.target.value })}
                    className="col-span-6 px-2 py-1 border rounded"
                  />
                  <input
                    type="number"
                    placeholder="Menge"
                    value={newPosition.menge}
                    onChange={(e) => setNewPosition({ ...newPosition, menge: parseFloat(e.target.value) || 0 })}
                    className="col-span-2 px-2 py-1 border rounded text-right"
                  />
                  <input
                    type="number"
                    placeholder="Preis"
                    value={newPosition.einzelpreis}
                    onChange={(e) => setNewPosition({ ...newPosition, einzelpreis: parseFloat(e.target.value) || 0 })}
                    className="col-span-2 px-2 py-1 border rounded text-right"
                    step="0.01"
                  />
                  <button
                    onClick={handleAddPosition}
                    className="col-span-2 bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Hinzufügen
                  </button>
                </div>
              </div>
            </div>

            {/* Summen */}
            <div className="bg-slate-100 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Summe Netto:</span>
                <span className="font-medium">{totals.summeNetto.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span>MwSt. (19%):</span>
                <span className="font-medium">{totals.mwst.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Summe Brutto:</span>
                <span>{totals.summeBrutto.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={printing}
          >
            {printing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Wird gedruckt...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 mr-2" />
                🖨️ PDF Drucken
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600">
            <Save className="w-4 h-4 mr-2" />
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
