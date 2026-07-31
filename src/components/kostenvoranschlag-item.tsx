'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, Plus, Trash2, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { KostenvoranschlagDetailsModal } from './kostenvoranschlag-details-modal'

interface Props {
  kostenvoranschlag: any
  betriebId: string
  onDelete: (id: string) => void
}

export function KostenvoranschlagItem({ kostenvoranschlag, betriebId, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [positionen, setPositionen] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modus, setModus] = useState<'festpreis' | 'einzeln'>('festpreis')
  const [festpreis, setFestpreis] = useState<number>(0)
  const [newPos, setNewPos] = useState({ beschreibung: '', preis: 0 })

  useEffect(() => {
    if (expanded && positionen.length === 0) {
      loadData()
    }
  }, [expanded])

  const loadData = async () => {
    setLoading(true)
    try {
      const supabase = await createClient()

      // Lade Positionen
      const { data: pos } = await supabase
        .from('kostenvoranschlag_position')
        .select('*')
        .eq('kostenvoranschlag_id', kostenvoranschlag.id)
        .order('created_at')

      setPositionen(pos || [])

      // Lade KV Daten (Modus + Festpreis)
      const { data: kv } = await supabase
        .from('kostenvoranschlaege')
        .select('ersatzteile_modus, ersatzteile_festpreis')
        .eq('id', kostenvoranschlag.id)
        .single()

      if (kv) {
        setModus(kv.ersatzteile_modus || 'festpreis')
        setFestpreis(kv.ersatzteile_festpreis || 0)
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleModusChange = async (newModus: 'festpreis' | 'einzeln') => {
    setModus(newModus)
    try {
      const supabase = await createClient()
      await supabase
        .from('kostenvoranschlaege')
        .update({ ersatzteile_modus: newModus })
        .eq('id', kostenvoranschlag.id)
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
    }
  }

  const handleAddPosition = async () => {
    if (!newPos.beschreibung.trim()) return

    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('kostenvoranschlag_position')
        .insert({
          kostenvoranschlag_id: kostenvoranschlag.id,
          beschreibung: newPos.beschreibung,
          menge: 1,
          preis: newPos.preis,
          summe: newPos.preis,
        })
        .select()

      if (error) throw error
      setPositionen([...positionen, data[0]])
      setNewPos({ beschreibung: '', preis: 0 })
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error)
      alert('Fehler beim Hinzufügen')
    }
  }

  const handleDeletePosition = async (posId: string) => {
    try {
      const supabase = await createClient()
      await supabase
        .from('kostenvoranschlag_position')
        .delete()
        .eq('id', posId)

      setPositionen(positionen.filter(p => p.id !== posId))
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      alert('Fehler beim Löschen')
    }
  }

  const handleSaveFestpreis = async () => {
    try {
      const supabase = await createClient()
      await supabase
        .from('kostenvoranschlaege')
        .update({ ersatzteile_festpreis: festpreis })
        .eq('id', kostenvoranschlag.id)
      alert('Festpreis gespeichert!')
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern')
    }
  }

  const ersatzteile_summe = positionen.reduce((sum, p) => sum + (p.summe || 0), 0)
  const gesamtsumme = modus === 'festpreis' ? festpreis : ersatzteile_summe

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
      >
        <div className="flex items-center gap-3 flex-1">
          <ChevronDown className={`w-5 h-5 transition ${expanded ? 'rotate-180' : ''}`} />
          <div className="text-left">
            <p className="font-medium">Kostenvoranschlag {kostenvoranschlag.id?.slice(0, 8)}</p>
            <p className="text-sm text-slate-600">{kostenvoranschlag.status || 'entwurf'}</p>
          </div>
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowModal(true)}
            className="text-blue-600 hover:text-blue-800"
            title="Details & Lieferschein"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(kostenvoranschlag.id)}
            className="text-red-600 hover:text-red-800"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </button>

      {expanded && (
        <div className="border-t p-4 space-y-6">
          {loading ? (
            <p className="text-sm text-slate-500">Wird geladen...</p>
          ) : (
            <>
              {/* Modus Toggle */}
              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="text-sm font-medium mb-3">⚙️ Ersatzteile-Modus:</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleModusChange('festpreis')}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition ${
                      modus === 'festpreis'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    💰 Festpreis (Pauschal)
                  </button>
                  <button
                    onClick={() => handleModusChange('einzeln')}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition ${
                      modus === 'einzeln'
                        ? 'bg-green-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    📋 Einzeln berechnen
                  </button>
                </div>
              </div>

              {/* MODUS 1: FESTPREIS */}
              {modus === 'festpreis' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <span>⚙️</span>
                      Benötigte Teile (ohne Preise)
                    </h4>

                    {positionen.length > 0 ? (
                      <ul className="space-y-2 mb-4">
                        {positionen.map((pos) => (
                          <li key={pos.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">☐</span>
                              <span className="text-sm">{pos.beschreibung}</span>
                            </div>
                            <button
                              onClick={() => handleDeletePosition(pos.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500 italic mb-4">Keine Teile erfasst</p>
                    )}

                    <div className="bg-green-50 p-3 rounded border-2 border-green-200 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <span>➕</span>
                        Neue Teile:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="z.B. Ölfilter, Bremsbeläge, Dichtungen"
                          value={newPos.beschreibung}
                          onChange={(e) => setNewPos({ ...newPos, beschreibung: e.target.value })}
                          className="flex-1 px-2 py-1 border rounded text-sm"
                        />
                        <button
                          onClick={handleAddPosition}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded border-2 border-blue-200 space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <span>💰</span>
                      Festpreis Ersatzteile (mit Kunde ausgehandelt)
                    </h4>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-slate-600 block mb-1">Gesamtpreis €</label>
                        <input
                          type="number"
                          placeholder="300,00"
                          value={festpreis}
                          onChange={(e) => setFestpreis(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border rounded text-sm"
                          step="0.01"
                        />
                      </div>
                      <button
                        onClick={handleSaveFestpreis}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 font-medium"
                      >
                        Speichern
                      </button>
                    </div>
                    {festpreis > 0 && (
                      <div className="text-sm font-medium text-blue-600 pt-2 border-t border-blue-200">
                        ✓ Ersatzteile in Rechnung: {festpreis.toFixed(2)} €
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MODUS 2: EINZELN BERECHNEN */}
              {modus === 'einzeln' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <span>⚙️</span>
                      Ersatzteile mit Preisen
                    </h4>

                    {positionen.length > 0 && (
                      <table className="w-full text-sm mb-4 border-collapse">
                        <thead>
                          <tr className="border-b bg-green-50">
                            <th className="text-left py-2 px-2">Teil</th>
                            <th className="text-right py-2 px-2 w-24">Preis €</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {positionen.map((pos) => (
                            <tr key={pos.id} className="border-b hover:bg-slate-50">
                              <td className="py-2 px-2">{pos.beschreibung}</td>
                              <td className="text-right py-2 px-2">{pos.preis.toFixed(2)} €</td>
                              <td className="text-center py-2 px-2">
                                <button
                                  onClick={() => handleDeletePosition(pos.id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          <tr className="font-bold bg-green-100">
                            <td className="py-2 px-2">Summe Ersatzteile:</td>
                            <td className="text-right py-2 px-2">{ersatzteile_summe.toFixed(2)} €</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    )}

                    <div className="bg-green-50 p-3 rounded border-2 border-green-200 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <span>➕</span>
                        Neues Teil:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Beschreibung"
                          value={newPos.beschreibung}
                          onChange={(e) => setNewPos({ ...newPos, beschreibung: e.target.value })}
                          className="col-span-2 px-2 py-1 border rounded text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Preis"
                          value={newPos.preis}
                          onChange={(e) => setNewPos({ ...newPos, preis: parseFloat(e.target.value) || 0 })}
                          className="px-2 py-1 border rounded text-sm"
                          step="0.01"
                        />
                      </div>
                      <button
                        onClick={handleAddPosition}
                        className="w-full bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center justify-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Teil hinzufügen
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-slate-100 p-3 rounded text-sm border-l-4 border-slate-400">
                <p>
                  <strong>Modus:</strong> {modus === 'festpreis' ? '💰 Festpreis' : '📋 Einzeln'} |
                  <strong className="ml-3">Ersatzteile gesamt:</strong> {gesamtsumme.toFixed(2)} €
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <KostenvoranschlagDetailsModal
        kostenvoranschlagId={kostenvoranschlag.id}
        betriebId={betriebId}
        open={showModal}
        onOpenChange={setShowModal}
      />
    </div>
  )
}
