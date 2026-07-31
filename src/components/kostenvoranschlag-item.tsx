'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface Props {
  kostenvoranschlag: any
  betriebId: string
  onDelete: (id: string) => void
}

export function KostenvoranschlagItem({ kostenvoranschlag, betriebId, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [positionen, setPositionen] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [festpreis, setFestpreis] = useState<number>(0)
  const [newPos, setNewPos] = useState({ beschreibung: '' })

  useEffect(() => {
    if (expanded && positionen.length === 0) {
      loadPositionen()
      loadFestpreis()
    }
  }, [expanded])

  const loadPositionen = async () => {
    setLoading(true)
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('kostenvoranschlag_positionen')
        .select('*')
        .eq('kostenvoranschlag_id', kostenvoranschlag.id)
        .order('created_at')

      if (error) throw error
      setPositionen(data || [])
    } catch (error) {
      console.error('Fehler beim Laden der Positionen:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFestpreis = async () => {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('kostenvoranschlaege')
        .select('festpreis_ersatzteile')
        .eq('id', kostenvoranschlag.id)
        .single()

      if (!error && data?.festpreis_ersatzteile) {
        setFestpreis(data.festpreis_ersatzteile)
      }
    } catch (error) {
      console.error('Fehler beim Laden des Festpreises:', error)
    }
  }

  const handleAddPosition = async () => {
    if (!newPos.beschreibung.trim()) return

    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('kostenvoranschlag_positionen')
        .insert({
          kostenvoranschlag_id: kostenvoranschlag.id,
          beschreibung: newPos.beschreibung,
          menge: 1,
          preis: 0,
          summe: 0,
        })
        .select()

      if (error) throw error
      setPositionen([...positionen, data[0]])
      setNewPos({ beschreibung: '' })
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error)
      alert('Fehler beim Hinzufügen')
    }
  }

  const handleDeletePosition = async (posId: string) => {
    try {
      const supabase = await createClient()
      await supabase
        .from('kostenvoranschlag_positionen')
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
      const { error } = await supabase
        .from('kostenvoranschlaege')
        .update({ festpreis_ersatzteile: festpreis })
        .eq('id', kostenvoranschlag.id)

      if (error) throw error
      alert('Festpreis gespeichert!')
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern')
    }
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
            <p className="font-medium">{kostenvoranschlag.id?.slice(0, 8)}</p>
            <p className="text-sm text-slate-600">{kostenvoranschlag.status || 'entwurf'}</p>
          </div>
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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
              {/* Benötigte Teile */}
              <div>
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <span>⚙️</span>
                  Benötigte Ersatzteile
                </h4>

                {positionen.length > 0 ? (
                  <ul className="space-y-2 mb-4">
                    {positionen.map((pos) => (
                      <li
                        key={pos.id}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded"
                      >
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

                {/* Neue Teile hinzufügen */}
                <div className="bg-green-50 p-3 rounded border-2 border-green-200 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <span>➕</span>
                    Neue Teile hinzufügen:
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

              {/* Festpreis Ersatzteile */}
              <div className="bg-blue-50 p-4 rounded border-2 border-blue-200 space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <span>💰</span>
                  Festpreis Ersatzteile (VK-Preis mit dem Kunden ausgehandelt)
                </h4>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-slate-600 block mb-1">Gesamt-Festpreis €</label>
                    <input
                      type="number"
                      placeholder="z.B. 300,00"
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
                    Intern: Diese Teile kosten uns ??? € | VK: {festpreis.toFixed(2)} € | Gewinn: ??? €
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-slate-100 p-3 rounded text-sm">
                <p>
                  <strong>KV-Summary:</strong> {positionen.length} Teile geplant | Festpreis: {festpreis.toFixed(2)} €
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
