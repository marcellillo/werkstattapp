'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Upload } from 'lucide-react'
import { LieferscheinScanner } from '@/components/lieferschein-scanner'
import { LieferscheinGalerie } from '@/components/lieferschein-galerie'
import { mitAufschlag } from '@/lib/ersatzteil-aufschlag'

interface Teil {
  id?: string
  beschreibung: string
  menge: number
  preis?: number
}

interface TeileErfassungTabsProps {
  betriebId: string
  fahrzeugId: string
  kostenvoranschlagId?: string
  auftragId: string
  onSuccess?: () => void
}

export function TeileErfassungTabs({
  betriebId,
  fahrzeugId,
  kostenvoranschlagId,
  auftragId,
  onSuccess,
}: TeileErfassungTabsProps) {
  const [mitPreisTeile, setMitPreisTeile] = useState<Teil[]>([])
  const [ohnePreisTeile, setOhnePreisTeile] = useState<Teil[]>([])
  const [newTeilMitPreis, setNewTeilMitPreis] = useState({ beschreibung: '', menge: 1, preis: 0 })
  const [newTeilOhnePreis, setNewTeilOhnePreis] = useState({ beschreibung: '', menge: 1 })
  const [saving, setSaving] = useState(false)
  const [galerieRefresh, setGalerieRefresh] = useState(0)

  const handleAddTeilMitPreis = async () => {
    if (!newTeilMitPreis.beschreibung.trim()) return

    const teil = { ...newTeilMitPreis, menge: parseFloat(String(newTeilMitPreis.menge)) || 1 }
    setMitPreisTeile([...mitPreisTeile, teil])
    setNewTeilMitPreis({ beschreibung: '', menge: 1, preis: 0 })

    // Auto-save zu Kostenvoranschlag wenn vorhanden
    if (kostenvoranschlagId) {
      await saveTeilToKostenvoranschlag(teil)
    }
  }

  const handleAddTeilOhnePreis = async () => {
    if (!newTeilOhnePreis.beschreibung.trim()) return

    const teil = { ...newTeilOhnePreis, menge: parseFloat(String(newTeilOhnePreis.menge)) || 1 }
    setOhnePreisTeile([...ohnePreisTeile, teil])
    setNewTeilOhnePreis({ beschreibung: '', menge: 1 })

    // Auto-save zu Kostenvoranschlag wenn vorhanden
    if (kostenvoranschlagId) {
      await saveTeilToKostenvoranschlag(teil)
    }
  }

  const saveTeilToKostenvoranschlag = async (teil: Teil) => {
    try {
      console.log('[SaveTeil] Sende Teil:', teil)
      const res = await fetch('/api/kostenvoranschlag/add-teile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kostenvoranschlag_id: kostenvoranschlagId,
          betrieb_id: betriebId,
          teile: [teil],
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        console.error('[SaveTeil] Fehler:', data)
        alert(`Fehler beim Speichern: ${data.error}`)
      } else {
        console.log('✅ Teil zu Kostenvoranschlag hinzugefügt:', data)
      }
    } catch (e: any) {
      console.error('[SaveTeil] Exception:', e)
      alert(`Fehler beim Speichern: ${e.message}`)
    }
  }

  const handleRemoveMitPreis = (idx: number) => {
    setMitPreisTeile(mitPreisTeile.filter((_, i) => i !== idx))
  }

  const handleRemoveOhnePreis = (idx: number) => {
    setOhnePreisTeile(ohnePreisTeile.filter((_, i) => i !== idx))
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      const allTeile = [...mitPreisTeile, ...ohnePreisTeile]
      if (!kostenvoranschlagId) {
        alert('Kein Kostenvoranschlag vorhanden')
        return
      }

      console.log('[SaveAll] Speichere Teile:', allTeile)

      const res = await fetch('/api/kostenvoranschlag/add-teile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kostenvoranschlag_id: kostenvoranschlagId,
          betrieb_id: betriebId,
          teile: allTeile,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        alert(`✅ ${data.hinzugefuegt} Teile gespeichert! (mit 45% Aufschlag)`)
        setMitPreisTeile([])
        setOhnePreisTeile([])
        onSuccess?.()
      } else {
        alert(`Fehler beim Speichern: ${data.error}`)
      }
    } catch (error: any) {
      console.error('[SaveAll] Error:', error)
      alert(`Fehler beim Speichern: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const totalMitPreis = mitPreisTeile.reduce((sum, t) => sum + mitAufschlag(t.menge * (t.preis || 0)), 0)
  const totalOhnePreis = ohnePreisTeile.length

  return (
    <Card className="p-6">
      <Tabs defaultValue="mit-preis" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mit-preis">
            💰 Mit Preis ({mitPreisTeile.length})
          </TabsTrigger>
          <TabsTrigger value="ohne-preis">
            📦 Ohne Preis ({ohnePreisTeile.length})
          </TabsTrigger>
        </TabsList>

        {/* Mit Preis Tab */}
        <TabsContent value="mit-preis" className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold mb-3">📸 Lieferschein scannen (mit Preis)</h3>
            <LieferscheinGalerie kostenvoranschlagId={kostenvoranschlagId} refreshSignal={galerieRefresh} />
            <LieferscheinScanner
              betriebId={betriebId}
              kostenvoranschlag_id={kostenvoranschlagId}
              auftragId={auftragId}
              onSuccess={() => {
                setGalerieRefresh(s => s + 1)
                onSuccess?.()
              }}
            />
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">+ Manuell hinzufügen:</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Teilebezeichnung (z.B. Bremsbeläge, Luftfilter)"
                value={newTeilMitPreis.beschreibung}
                onChange={(e) => setNewTeilMitPreis({ ...newTeilMitPreis, beschreibung: e.target.value })}
                className="w-full px-3 py-2 border rounded text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="Menge"
                  value={newTeilMitPreis.menge}
                  onChange={(e) => setNewTeilMitPreis({ ...newTeilMitPreis, menge: parseFloat(e.target.value) || 0 })}
                  className="px-2 py-1 border rounded text-sm"
                  min="0"
                  step="0.1"
                />
                <input
                  type="number"
                  placeholder="Preis (€)"
                  value={newTeilMitPreis.preis}
                  onChange={(e) => setNewTeilMitPreis({ ...newTeilMitPreis, preis: parseFloat(e.target.value) || 0 })}
                  className="px-2 py-1 border rounded text-sm"
                  min="0"
                  step="0.01"
                />
                <Button
                  onClick={handleAddTeilMitPreis}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Teile Liste */}
          {mitPreisTeile.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Teile ({mitPreisTeile.length}):</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {mitPreisTeile.map((teil, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-blue-50 p-3 rounded border border-blue-100">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{teil.beschreibung}</p>
                      <p className="text-xs text-gray-600">
                        {teil.menge}x @ {teil.preis?.toFixed(2)} € = {mitAufschlag(teil.menge * (teil.preis || 0)).toFixed(2)} € (mit 45% Aufschlag)
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveMitPreis(idx)}
                      className="text-red-600 hover:text-red-800 ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-2 bg-gray-50 rounded text-sm font-semibold">
                Summe (mit 45% Aufschlag): {totalMitPreis.toFixed(2)} €
              </div>
            </div>
          )}
        </TabsContent>

        {/* Ohne Preis Tab */}
        <TabsContent value="ohne-preis" className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold mb-3">➕ Teile ohne Preis erfassen:</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Teilebezeichnung"
                value={newTeilOhnePreis.beschreibung}
                onChange={(e) => setNewTeilOhnePreis({ ...newTeilOhnePreis, beschreibung: e.target.value })}
                className="w-full px-3 py-2 border rounded text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Menge"
                  value={newTeilOhnePreis.menge}
                  onChange={(e) => setNewTeilOhnePreis({ ...newTeilOhnePreis, menge: parseFloat(e.target.value) || 0 })}
                  className="px-2 py-1 border rounded text-sm"
                  min="0"
                  step="0.1"
                />
                <Button
                  onClick={handleAddTeilOhnePreis}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Teile Liste */}
          {ohnePreisTeile.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Teile ({ohnePreisTeile.length}):</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ohnePreisTeile.map((teil, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-green-50 p-3 rounded border border-green-100">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{teil.beschreibung}</p>
                      <p className="text-xs text-gray-600">Menge: {teil.menge}x</p>
                    </div>
                    <button
                      onClick={() => handleRemoveOhnePreis(idx)}
                      className="text-red-600 hover:text-red-800 ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      {(mitPreisTeile.length > 0 || ohnePreisTeile.length > 0) && (
        <div className="mt-6 pt-4 border-t flex gap-2">
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {saving ? '⏳ Wird gespeichert...' : `💾 Speichern (${mitPreisTeile.length + ohnePreisTeile.length} Teile)`}
          </Button>
        </div>
      )}
    </Card>
  )
}
