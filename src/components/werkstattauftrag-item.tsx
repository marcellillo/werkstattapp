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
    menge: 1,
    preis: 0,
    typ: 'arbeit' // 'arbeit' oder 'ersatzteil'
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

    try {
      const supabase = await createClient()
      const summe = newPos.menge * newPos.preis

      const insertData: any = {
        werkstattauftrag_id: werkstattauftrag.id,
        beschreibung: newPos.beschreibung,
        menge: newPos.menge,
        preis: newPos.preis,
        summe,
      }

      // Versuche typ zu speichern, ignoriere Fehler wenn Feld nicht existiert
      if (newPos.typ) {
        insertData.typ = newPos.typ
      }

      const { data, error } = await supabase
        .from('werkstattauftrag_positionen')
        .insert(insertData)
        .select()

      if (error) {
        console.error('Insert error:', error)
        throw error
      }

      setPositionen([...positionen, data[0]])
      setNewPos({ beschreibung: '', menge: 1, preis: 0, typ: 'arbeit' })
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error)
      alert('Fehler beim Hinzufügen der Position')
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
              {/* Positionen Tabelle */}
              {positionen.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">🔧 Arbeitszeiten</h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-blue-50">
                          <th className="text-left py-2 px-2">Arbeit / Tätigkeit</th>
                          <th className="text-right py-2 px-2 w-20">Std/Menge</th>
                          <th className="text-right py-2 px-2 w-24">€/Std</th>
                          <th className="text-right py-2 px-2 w-24">Summe</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {positionen.filter(p => !p.typ || p.typ === 'arbeit').map((pos) => (
                          <tr key={pos.id} className="border-b hover:bg-slate-50">
                            <td className="py-2 px-2">{pos.beschreibung}</td>
                            <td className="text-right py-2 px-2">{pos.menge}</td>
                            <td className="text-right py-2 px-2">{pos.preis.toFixed(2)} €</td>
                            <td className="text-right py-2 px-2 font-medium">{(pos.summe || 0).toFixed(2)} €</td>
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

                  {positionen.some(p => p.typ === 'ersatzteil') && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">⚙️ Ersatzteile</h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-green-50">
                            <th className="text-left py-2 px-2">Ersatzteil / Material</th>
                            <th className="text-right py-2 px-2 w-20">Menge</th>
                            <th className="text-right py-2 px-2 w-24">€/Stck</th>
                            <th className="text-right py-2 px-2 w-24">Summe</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {positionen.filter(p => p.typ === 'ersatzteil').map((pos) => (
                            <tr key={pos.id} className="border-b hover:bg-slate-50">
                              <td className="py-2 px-2">{pos.beschreibung}</td>
                              <td className="text-right py-2 px-2">{pos.menge}</td>
                              <td className="text-right py-2 px-2">{pos.preis.toFixed(2)} €</td>
                              <td className="text-right py-2 px-2 font-medium">{(pos.summe || 0).toFixed(2)} €</td>
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
                </div>
              )}

              {positionen.length === 0 && !loading && (
                <p className="text-sm text-slate-500 text-center py-4">Keine Positionen</p>
              )}

              {/* Neue Position hinzufügen */}
              <div className="bg-slate-50 p-3 rounded space-y-3">
                <p className="text-sm font-medium">➕ Position hinzufügen:</p>
                <div className="space-y-2">
                  <select
                    value={newPos.typ}
                    onChange={(e) => setNewPos({ ...newPos, typ: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="arbeit">🔧 Arbeitszeit / Tätigkeit</option>
                    <option value="ersatzteil">⚙️ Ersatzteil / Material</option>
                  </select>

                  <input
                    type="text"
                    placeholder={newPos.typ === 'arbeit' ? 'z.B. Ölwechsel, Inspektion, Reparatur' : 'z.B. Bremsbeläge, Ölfilter'}
                    value={newPos.beschreibung}
                    onChange={(e) => setNewPos({ ...newPos, beschreibung: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder={newPos.typ === 'arbeit' ? 'Std' : 'Menge'}
                      value={newPos.menge}
                      onChange={(e) => setNewPos({ ...newPos, menge: parseFloat(e.target.value) || 0 })}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <input
                      type="number"
                      placeholder={newPos.typ === 'arbeit' ? '€/Std' : '€/Stck'}
                      value={newPos.preis}
                      onChange={(e) => setNewPos({ ...newPos, preis: parseFloat(e.target.value) || 0 })}
                      className="px-2 py-1 border rounded text-sm"
                      step="0.01"
                    />
                    <button
                      onClick={handleAddPosition}
                      className="bg-blue-600 text-white px-2 py-1 rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>

                  {newPos.menge > 0 && newPos.preis > 0 && (
                    <div className="text-xs text-slate-600 text-right">
                      = {(newPos.menge * newPos.preis).toFixed(2)} €
                    </div>
                  )}
                </div>
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
