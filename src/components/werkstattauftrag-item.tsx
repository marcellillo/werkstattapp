'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, Plus, Trash2, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface Props {
  werkstattauftrag: any
  betriebId: string
  onDelete: (id: string) => void
}

export function WerkstattauftragItem({ werkstattauftrag, betriebId, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [positionen, setPositionen] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(werkstattauftrag.status || 'neu')
  const [newPos, setNewPos] = useState({
    beschreibung: '',
    stunden: 1,
    stundensatz: 0,
  })

  useEffect(() => {
    if (expanded && positionen.length === 0) {
      loadPositionen()
    }
  }, [expanded])

  const loadPositionen = async () => {
    setLoading(true)
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('werkstattauftrag_positionen')
        .select('*')
        .eq('werkstattauftrag_id', werkstattauftrag.id)
        .order('created_at')

      if (error) throw error
      setPositionen(data || [])
    } catch (error) {
      console.error('Fehler beim Laden der Positionen:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const supabase = await createClient()
      const { error } = await supabase
        .from('werkstattauftraege')
        .update({ status: newStatus })
        .eq('id', werkstattauftrag.id)
        .eq('betrieb_id', betriebId)

      if (error) throw error
      setStatus(newStatus)
    } catch (error) {
      console.error('Fehler beim Status-Update:', error)
      alert('Fehler beim Ändern des Status')
    }
  }

  const handleAddPosition = async () => {
    if (!newPos.beschreibung.trim()) return
    if (newPos.stunden <= 0 || newPos.stundensatz < 0) {
      alert('Bitte Stunden und Stundensatz eingeben')
      return
    }

    try {
      const supabase = await createClient()
      const summe = newPos.stunden * newPos.stundensatz

      const { data, error } = await supabase
        .from('werkstattauftrag_positionen')
        .insert({
          werkstattauftrag_id: werkstattauftrag.id,
          beschreibung: newPos.beschreibung,
          menge: newPos.stunden,
          preis: newPos.stundensatz,
          summe,
        })
        .select()

      if (error) {
        console.error('Insert error:', error)
        throw error
      }

      setPositionen([...positionen, data[0]])
      setNewPos({ beschreibung: '', stunden: 1, stundensatz: 0 })
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error)
      alert('Fehler beim Hinzufügen der Arbeit')
    }
  }

  const handleDeletePosition = async (posId: string) => {
    try {
      const supabase = await createClient()
      await supabase
        .from('werkstattauftrag_positionen')
        .delete()
        .eq('id', posId)

      setPositionen(positionen.filter(p => p.id !== posId))
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      alert('Fehler beim Löschen')
    }
  }

  const totals = {
    netto: positionen.reduce((sum, p) => sum + (p.summe || 0), 0),
  }
  totals.mwst = totals.netto * 0.19
  totals.brutto = totals.netto + totals.mwst

  const statusColors = {
    neu: 'bg-blue-100 text-blue-800',
    in_bearbeitung: 'bg-yellow-100 text-yellow-800',
    fertig: 'bg-green-100 text-green-800',
    abgeschlossen: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
      >
        <div className="flex items-center gap-3 flex-1">
          <ChevronDown className={`w-5 h-5 transition ${expanded ? 'rotate-180' : ''}`} />
          <div className="text-left">
            <p className="font-medium">Werkstattauftrag {werkstattauftrag.id.slice(0, 8)}</p>
            <p className={`text-xs px-2 py-1 rounded mt-1 w-fit ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100'}`}>
              {status === 'neu' && 'Neu'}
              {status === 'in_bearbeitung' && 'In Bearbeitung'}
              {status === 'fertig' && 'Fertig'}
              {status === 'abgeschlossen' && 'Abgeschlossen'}
            </p>
          </div>
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(werkstattauftrag.id)}
            className="text-red-600 hover:text-red-800"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </button>

      {expanded && (
        <div className="border-t p-4 space-y-4">
          {/* Status-Buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={status === 'neu' ? 'default' : 'outline'}
              onClick={() => handleStatusChange('neu')}
              className="text-xs"
            >
              Neu
            </Button>
            <Button
              size="sm"
              variant={status === 'in_bearbeitung' ? 'default' : 'outline'}
              onClick={() => handleStatusChange('in_bearbeitung')}
              className="text-xs"
            >
              In Bearbeitung
            </Button>
            <Button
              size="sm"
              variant={status === 'fertig' ? 'default' : 'outline'}
              onClick={() => handleStatusChange('fertig')}
              className="text-xs"
            >
              Fertig
            </Button>
            <Button
              size="sm"
              variant={status === 'abgeschlossen' ? 'default' : 'outline'}
              onClick={() => handleStatusChange('abgeschlossen')}
              className="text-xs"
            >
              Abgeschlossen
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Wird geladen...</p>
          ) : (
            <>
              {/* Arbeitszeiten Tabelle */}
              {positionen.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <span className="text-lg">🔧</span>
                    Arbeitszeiten
                  </h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-blue-50">
                        <th className="text-left py-2 px-2">Tätigkeit / Arbeit</th>
                        <th className="text-right py-2 px-2 w-16">Stunden</th>
                        <th className="text-right py-2 px-2 w-20">€/Std</th>
                        <th className="text-right py-2 px-2 w-20">Summe</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {positionen.map((pos) => (
                        <tr key={pos.id} className="border-b hover:bg-slate-50">
                          <td className="py-2 px-2">{pos.beschreibung}</td>
                          <td className="text-right py-2 px-2">{pos.menge} h</td>
                          <td className="text-right py-2 px-2">{pos.preis.toFixed(2)} €</td>
                          <td className="text-right py-2 px-2 font-medium text-blue-600">{(pos.summe || 0).toFixed(2)} €</td>
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
                    </tbody>
                  </table>
                </div>
              )}

              {positionen.length === 0 && !loading && (
                <p className="text-sm text-slate-500 text-center py-4 italic">Keine Arbeitszeiten erfasst</p>
              )}

              {/* Arbeitszeit hinzufügen */}
              <div className="bg-blue-50 p-4 rounded space-y-3 border-2 border-blue-200">
                <p className="text-sm font-medium flex items-center gap-2">
                  <span>➕</span>
                  Arbeitszeit hinzufügen:
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="z.B. Ölwechsel, Inspektion, Bremsanlage überprüfen"
                    value={newPos.beschreibung}
                    onChange={(e) => setNewPos({ ...newPos, beschreibung: e.target.value })}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-600">Stunden</label>
                      <input
                        type="number"
                        placeholder="1,5"
                        value={newPos.stunden}
                        onChange={(e) => setNewPos({ ...newPos, stunden: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        step="0.5"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">€/Std</label>
                      <input
                        type="number"
                        placeholder="55,00"
                        value={newPos.stundensatz}
                        onChange={(e) => setNewPos({ ...newPos, stundensatz: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <button
                      onClick={handleAddPosition}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-1 col-span-1 self-end"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>

                  {newPos.stunden > 0 && newPos.stundensatz > 0 && (
                    <div className="text-sm font-medium text-blue-600 text-right">
                      Summe: {(newPos.stunden * newPos.stundensatz).toFixed(2)} €
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-600 italic border-t pt-2">
                  💡 Ersatzteile und Material-Kosten werden aus der Lieferbestätigung erfasst
                </p>
              </div>

              {/* Totals */}
              <div className="bg-blue-50 p-3 rounded space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Netto:</span>
                  <span className="font-medium">{totals.netto.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>MwSt (19%):</span>
                  <span className="font-medium">{totals.mwst.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-1">
                  <span>Brutto:</span>
                  <span>{totals.brutto.toFixed(2)} €</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
