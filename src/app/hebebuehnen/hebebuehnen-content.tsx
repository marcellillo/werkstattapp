'use client'
import { useState, useEffect, useTransition } from 'react'
import { Plus, Pencil, Trash2, Lock, Unlock, GripVertical, Check, X, ShieldCheck, Clock, Car, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { addBuehne, updateBuehne, deleteBuehne } from './actions'

interface Buehne {
  id: string
  nummer: number
  bezeichnung: string
  beschreibung?: string
  erstellt_am: string
}

interface UIState {
  order: string[]      // bay IDs in display order
  locked: string[]     // locked bay IDs
}

const LS_KEY = 'werkstatt_buehnen_ui'

function loadUI(buehnen: Buehne[]): UIState {
  if (typeof window === 'undefined') return { order: buehnen.map(b => b.id), locked: [] }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const saved: UIState = JSON.parse(raw)
      // merge: keep saved order but add any new bays at end
      const knownIds = new Set(saved.order)
      const newIds = buehnen.map(b => b.id).filter(id => !knownIds.has(id))
      return { order: [...saved.order.filter(id => buehnen.some(b => b.id === id)), ...newIds], locked: saved.locked.filter(id => buehnen.some(b => b.id === id)) }
    }
  } catch {}
  return { order: buehnen.map(b => b.id), locked: [] }
}

function saveUI(ui: UIState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(ui)) } catch {}
}

export function HebebuehnenContent({ hebebuehnen: init, termine = [] }: { hebebuehnen: Buehne[]; termine?: any[] }) {
  const [buehnen, setBuehnen] = useState<Buehne[]>(init)
  const [ui, setUI] = useState<UIState>({ order: init.map(b => b.id), locked: [] })
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editBeschreibung, setEditBeschreibung] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBeschreibung, setNewBeschreibung] = useState('')
  const [error, setError] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Load UI state from localStorage on mount
  useEffect(() => {
    setUI(loadUI(init))
  }, [])

  function updateUI(next: UIState) {
    setUI(next)
    saveUI(next)
  }

  // Ordered buehnen for display
  const sorted = [...buehnen].sort((a, b) => {
    const ia = ui.order.indexOf(a.id)
    const ib = ui.order.indexOf(b.id)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })

  async function handleAdd() {
    if (!newName.trim()) { setError('Bitte einen Namen eingeben.'); return }
    setError('')
    startTransition(async () => {
      const res = await addBuehne(newName, newBeschreibung)
      if (res?.error) { setError(res.error); return }
      setNewName(''); setNewBeschreibung(''); setShowAdd(false)
      // revalidatePath in action triggers page refresh with new data
    })
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) return
    setBuehnen(prev => prev.map(b => b.id === id ? { ...b, bezeichnung: editName, beschreibung: editBeschreibung } : b))
    setEditId(null)
    startTransition(() => updateBuehne(id, editName, editBeschreibung))
  }

  async function handleDelete(id: string) {
    if (!confirm('Hebebühne wirklich löschen?')) return
    setBuehnen(prev => prev.filter(b => b.id !== id))
    updateUI({ order: ui.order.filter(x => x !== id), locked: ui.locked.filter(x => x !== id) })
    startTransition(() => deleteBuehne(id))
  }

  function handleToggleLock(id: string) {
    const locked = ui.locked.includes(id)
      ? ui.locked.filter(x => x !== id)
      : [...ui.locked, id]
    updateUI({ ...ui, locked })
  }

  function onDragStart(id: string) {
    if (ui.locked.includes(id)) return
    setDragId(id)
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    if (ui.locked.includes(targetId)) { setDragId(null); setDragOverId(null); return }
    const order = [...ui.order]
    const fromIdx = order.indexOf(dragId)
    const toIdx = order.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); setDragOverId(null); return }
    order.splice(fromIdx, 1)
    order.splice(toIdx, 0, dragId)
    updateUI({ ...ui, order })
    setDragId(null); setDragOverId(null)
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-800">Bühnen per Drag & Drop sortieren · Schloss = Position fixiert</p>
        <Button onClick={() => { setShowAdd(v => !v); setError('') }} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Neue Bühne
        </Button>
      </div>

      {showAdd && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4 space-y-3">
            <div>
              <label className="text-xs text-gray-800 mb-1 block">Bezeichnung *</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="z.B. Bühne 4"
                autoFocus
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-800 mb-1 block">Beschreibung</label>
              <input
                value={newBeschreibung}
                onChange={e => setNewBeschreibung(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={isPending} className="bg-orange-600 hover:bg-orange-700 text-white">
                {isPending ? 'Speichern...' : 'Hinzufügen'}
              </Button>
              <Button onClick={() => { setShowAdd(false); setError('') }} variant="ghost">Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {sorted.map(b => {
          const isLocked = ui.locked.includes(b.id)
          const isDialog = b.bezeichnung.toLowerCase().includes('dialog')
          const buehneTermine = termine.filter(t => t.hebebuehne_id === b.id)
          const today = new Date().toISOString().split('T')[0]
          const todayTermine = buehneTermine.filter(t => t.datum === today)
          const nextTermin = buehneTermine[0]
          return (
            <div
              key={b.id}
              draggable={!isLocked && editId !== b.id}
              onDragStart={() => onDragStart(b.id)}
              onDragOver={e => { e.preventDefault(); if (dragId && dragId !== b.id) setDragOverId(b.id) }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={() => onDrop(b.id)}
              className={cn(
                'bg-white border-2 rounded-xl p-4 transition-all duration-150 select-none',
                dragOverId === b.id ? 'border-orange-400 bg-orange-50 scale-[1.01]' : isLocked ? 'border-orange-100 bg-orange-50/30' : 'border-gray-200',
                !isLocked && editId !== b.id ? 'cursor-grab active:cursor-grabbing' : '',
                dragId === b.id ? 'opacity-40' : ''
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('flex-shrink-0', isLocked ? 'text-orange-300' : 'text-gray-200')}>
                  <GripVertical className="w-5 h-5" />
                </div>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0', isDialog ? 'bg-blue-500' : 'bg-orange-500')}>
                  {b.nummer}
                </div>

                {editId === b.id ? (
                  <div className="flex-1 space-y-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleEdit(b.id)}
                      className="w-full px-3 py-1.5 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    <input value={editBeschreibung} onChange={e => setEditBeschreibung(e.target.value)} placeholder="Beschreibung"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{b.bezeichnung}</p>
                    {b.beschreibung && <p className="text-xs text-gray-600 truncate">{b.beschreibung}</p>}
                  </div>
                )}

                <div className="flex items-center gap-1 flex-shrink-0">
                  {editId === b.id ? (
                    <>
                      <button onClick={() => handleEdit(b.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditId(null)} className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleToggleLock(b.id)}
                        title={isLocked ? 'Entsperren' : 'Position sperren'}
                        className={cn('p-2 rounded-lg transition-colors', isLocked ? 'text-orange-600 bg-orange-100 hover:bg-orange-200' : 'text-gray-300 hover:text-gray-800 hover:bg-gray-50')}
                      >
                        {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      <button onClick={() => { setEditId(b.id); setEditName(b.bezeichnung); setEditBeschreibung(b.beschreibung ?? '') }}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(b.id)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>

              {isLocked && (
                <div className="mt-2 ml-16 flex items-center gap-1 text-xs text-orange-500">
                  <Lock className="w-3 h-3" /> Position gesperrt
                </div>
              )}

              {/* TÜV Termine */}
              {buehneTermine.length > 0 && (
                <div className="mt-3 ml-13 space-y-1.5 pl-13">
                  {todayTermine.length > 0 && (
                    <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide ml-13 pl-1">Heute</p>
                  )}
                  {buehneTermine.slice(0, 3).map(t => {
                    const isToday = t.datum === today
                    return (
                      <div key={t.id} className={cn(
                        'ml-13 flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
                        isToday ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-100'
                      )}>
                        <ShieldCheck className={cn('w-3.5 h-3.5 flex-shrink-0', isToday ? 'text-yellow-600' : 'text-gray-400')} />
                        <span className={cn('font-semibold', isToday ? 'text-yellow-800' : 'text-gray-600')}>
                          TÜV {isToday ? 'Heute' : new Date(t.datum + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {t.uhrzeit && ` · ${t.uhrzeit.slice(0, 5)} Uhr`}
                        </span>
                        {t.dauer_minuten && (
                          <span className="flex items-center gap-0.5 text-gray-500">
                            <Clock className="w-3 h-3" />{t.dauer_minuten} Min.
                          </span>
                        )}
                        {t.fahrzeug && (
                          <span className="flex items-center gap-0.5 text-gray-500 ml-auto">
                            <Car className="w-3 h-3" />{t.fahrzeug.kennzeichen}
                          </span>
                        )}
                        {!t.fahrzeug && t.kunde && (
                          <span className="flex items-center gap-0.5 text-gray-500 ml-auto">
                            <User className="w-3 h-3" />{t.kunde.vorname} {t.kunde.nachname}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {buehnen.length === 0 && !showAdd && (
        <div className="text-center py-16 text-gray-300">
          <p className="text-lg font-medium">Keine Hebebühnen angelegt</p>
          <p className="text-sm mt-1">Klicke auf "Neue Bühne" um zu starten</p>
        </div>
      )}
    </div>
  )
}

