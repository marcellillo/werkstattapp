'use client'
import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  Plus, Pencil, Trash2, Lock, Unlock, GripVertical, Check, X,
  ShieldCheck, Clock, Car, User, ChevronRight, Package, Euro,
  Wrench, MapPin, Gauge, Tag, Fuel, ExternalLink, Image as ImageIcon
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { addBuehne, updateBuehne, deleteBuehne } from './actions'
import { FAHRZEUG_STATUS_LABEL, FAHRZEUG_STATUS_COLOR, type FahrzeugStatus } from '@/types/database'

interface Buehne {
  id: string
  nummer: number
  bezeichnung: string
  beschreibung?: string
  erstellt_am: string
}

interface UIState {
  order: string[]
  locked: string[]
}

const LS_KEY = 'werkstatt_buehnen_ui'

function loadUI(buehnen: Buehne[]): UIState {
  if (typeof window === 'undefined') return { order: buehnen.map(b => b.id), locked: [] }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const saved: UIState = JSON.parse(raw)
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

// ─── Fahrzeug-Detail-Modal ────────────────────────────────────────────────────
function FahrzeugModal({ auftrag, onClose }: { auftrag: any; onClose: () => void }) {
  const fz = auftrag.fahrzeug as any
  const teile = (auftrag.ersatzteile ?? []) as any[]
  const einnahmen: number = auftrag.einnahmen ?? 0
  const teileKosten = teile.reduce((s: number, t: any) => s + (t.einzelpreis ?? 0) * (t.menge ?? 1), 0)

  const bilderUrls: string[] = (() => {
    try { return fz?.bilder_urls ? JSON.parse(fz.bilder_urls) : [] } catch { return [] }
  })()

  const TEIL_STATUS_LABEL: Record<string, string> = {
    nicht_bestellt: 'Nicht bestellt', bestellt: 'Bestellt',
    unterwegs: 'Unterwegs', geliefert: 'Geliefert', eingebaut: 'Eingebaut',
  }
  const TEIL_STATUS_COLOR: Record<string, string> = {
    nicht_bestellt: 'bg-red-50 text-red-700 border-red-200',
    bestellt: 'bg-blue-50 text-blue-700 border-blue-200',
    unterwegs: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    geliefert: 'bg-green-50 text-green-700 border-green-200',
    eingebaut: 'bg-gray-50 text-gray-600 border-gray-200',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Bilder */}
        {bilderUrls.length > 0 ? (
          <div className="flex gap-1.5 overflow-x-auto px-4 pt-3 pb-0 snap-x">
            {bilderUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${fz?.marke} ${fz?.modell} Bild ${i + 1}`}
                className="h-44 w-auto flex-shrink-0 rounded-xl object-cover snap-start"
              />
            ))}
          </div>
        ) : (
          <div className="mx-4 mt-4 h-28 bg-gray-100 rounded-xl flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-300" />
          </div>
        )}

        <div className="px-5 py-4 space-y-4">
          {/* Fahrzeug-Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{fz?.marke} {fz?.modell}</h2>
              <p className="text-sm font-mono text-gray-500">{fz?.kennzeichen}</p>
            </div>
            <span className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0',
              FAHRZEUG_STATUS_COLOR[auftrag.status as FahrzeugStatus]
            )}>
              {FAHRZEUG_STATUS_LABEL[auftrag.status as FahrzeugStatus]}
            </span>
          </div>

          {/* Fahrzeugdaten */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600 bg-gray-50 rounded-xl p-3">
            {fz?.baujahr && <div className="flex items-center gap-1.5"><Tag className="w-3 h-3 text-gray-400" />{fz.baujahr}</div>}
            {fz?.kilometerstand && <div className="flex items-center gap-1.5"><Gauge className="w-3 h-3 text-gray-400" />{fz.kilometerstand.toLocaleString('de-DE')} km</div>}
            {fz?.motortyp && <div className="flex items-center gap-1.5"><Fuel className="w-3 h-3 text-gray-400" />{fz.motortyp}{fz.leistung_kw ? ` · ${fz.leistung_kw} kW` : ''}</div>}
            {fz?.farbe && <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0 inline-block" style={{ background: fz.farbe.toLowerCase() }} />{fz.farbe}</div>}
            {auftrag.kunde && (
              <div className="flex items-center gap-1.5 col-span-2">
                <User className="w-3 h-3 text-gray-400" />
                {auftrag.kunde.vorname} {auftrag.kunde.nachname}
                {auftrag.kunde.firma && <span className="text-gray-400">· {auftrag.kunde.firma}</span>}
              </div>
            )}
          </div>

          {/* Arbeiten */}
          {auftrag.arbeiten && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Arbeiten</p>
              <div className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-xl p-3 text-sm text-gray-700">
                <Wrench className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <span>{auftrag.arbeiten}</span>
              </div>
            </div>
          )}

          {/* Bemerkungen */}
          {auftrag.bemerkungen && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">{auftrag.bemerkungen}</div>
          )}

          {/* Kosten-Übersicht */}
          {(einnahmen > 0 || teileKosten > 0) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Kosten</p>
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-1.5 text-sm">
                {teileKosten > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-gray-400" /> Materialkosten</span>
                    <span className="font-medium">{teileKosten.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                  </div>
                )}
                {einnahmen > 0 && (
                  <div className="flex justify-between text-green-800 font-semibold pt-1 border-t border-green-200">
                    <span className="flex items-center gap-1.5"><Euro className="w-3.5 h-3.5" /> Gesamtrechnung</span>
                    <span>{einnahmen.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Teile-Liste */}
          {teile.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Ersatzteile ({teile.length})
              </p>
              <div className="space-y-1.5">
                {teile.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{t.bezeichnung}</p>
                      {t.teilenummer && <p className="text-gray-400 font-mono">{t.teilenummer}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {t.einzelpreis && (
                        <span className="text-gray-600">{(t.einzelpreis * t.menge).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                      )}
                      <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-medium', TEIL_STATUS_COLOR[t.status] ?? 'bg-gray-50 text-gray-500 border-gray-200')}>
                        {TEIL_STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1 pb-2">
            <Link href={`/fahrzeuge/${auftrag.id}`} className="flex-1">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-medium transition-colors">
                <ExternalLink className="w-4 h-4" /> Vollständiger Auftrag
              </button>
            </Link>
            <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-medium transition-colors">
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export function HebebuehnenContent({
  hebebuehnen: init,
  termine = [],
  auftraege = [],
}: {
  hebebuehnen: Buehne[]
  termine?: any[]
  auftraege?: any[]
}) {
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
  const [selectedAuftrag, setSelectedAuftrag] = useState<any | null>(null)

  useEffect(() => { setUI(loadUI(init)) }, [])

  function updateUI(next: UIState) { setUI(next); saveUI(next) }

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
    })
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) return
    setBuehnen(prev => prev.map(b => b.id === id ? { ...b, bezeichnung: editName, beschreibung: editBeschreibung } : b))
    setEditId(null)
    startTransition(() => { updateBuehne(id, editName, editBeschreibung) })
  }

  async function handleDelete(id: string) {
    if (!confirm('Hebebühne wirklich löschen?')) return
    setBuehnen(prev => prev.filter(b => b.id !== id))
    updateUI({ order: ui.order.filter(x => x !== id), locked: ui.locked.filter(x => x !== id) })
    startTransition(() => { deleteBuehne(id) })
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
    <>
      {selectedAuftrag && (
        <FahrzeugModal auftrag={selectedAuftrag} onClose={() => setSelectedAuftrag(null)} />
      )}

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
                  value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  placeholder="z.B. Bühne 4" autoFocus
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-800 mb-1 block">Beschreibung</label>
                <input
                  value={newBeschreibung} onChange={e => setNewBeschreibung(e.target.value)}
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
            const buehneAuftraege = auftraege.filter(a => a.hebebuehne_id === b.id)
            const today = new Date().toISOString().split('T')[0]
            const todayTermine = buehneTermine.filter(t => t.datum === today)

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
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{b.bezeichnung}</p>
                        {buehneAuftraege.length > 0 && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                            {buehneAuftraege.length} Fahrzeug{buehneAuftraege.length > 1 ? 'e' : ''}
                          </span>
                        )}
                      </div>
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
                        <button onClick={() => handleToggleLock(b.id)} title={isLocked ? 'Entsperren' : 'Position sperren'}
                          className={cn('p-2 rounded-lg transition-colors', isLocked ? 'text-orange-600 bg-orange-100 hover:bg-orange-200' : 'text-gray-300 hover:text-gray-800 hover:bg-gray-50')}>
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

                {/* Aktuelle Fahrzeuge auf dieser Bühne */}
                {buehneAuftraege.length > 0 && (
                  <div className="mt-3 ml-[52px] space-y-2">
                    {buehneAuftraege.map(auftrag => {
                      const fz = auftrag.fahrzeug as any
                      const teile = (auftrag.ersatzteile ?? []) as any[]
                      const einnahmen: number = auftrag.einnahmen ?? 0
                      const teileKosten = teile.reduce((s: number, t: any) => s + (t.einzelpreis ?? 0) * (t.menge ?? 1), 0)
                      const bilderUrls: string[] = (() => { try { return fz?.bilder_urls ? JSON.parse(fz.bilder_urls) : [] } catch { return [] } })()
                      const hauptbild = bilderUrls[0] ?? null

                      return (
                        <button
                          key={auftrag.id}
                          onClick={() => setSelectedAuftrag(auftrag)}
                          className="w-full text-left bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-xl p-3 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            {hauptbild ? (
                              <img src={hauptbild} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Car className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-sm group-hover:text-orange-700 transition-colors">
                                {fz?.marke} {fz?.modell}
                              </p>
                              <p className="text-xs font-mono text-gray-500">{fz?.kennzeichen}</p>
                              {auftrag.arbeiten && (
                                <p className="text-xs text-gray-500 truncate mt-0.5">{auftrag.arbeiten}</p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', FAHRZEUG_STATUS_COLOR[auftrag.status as FahrzeugStatus])}>
                                {FAHRZEUG_STATUS_LABEL[auftrag.status as FahrzeugStatus]}
                              </span>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                {teile.length > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <Package className="w-3 h-3" />{teile.length}
                                  </span>
                                )}
                                {(einnahmen > 0 || teileKosten > 0) && (
                                  <span className="flex items-center gap-0.5 text-green-700 font-medium">
                                    <Euro className="w-3 h-3" />
                                    {(einnahmen || teileKosten).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* TÜV Termine */}
                {buehneTermine.length > 0 && (
                  <div className="mt-3 ml-[52px] space-y-1.5">
                    {todayTermine.length > 0 && (
                      <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide pl-1">Heute</p>
                    )}
                    {buehneTermine.slice(0, 3).map(t => {
                      const isToday = t.datum === today
                      return (
                        <div key={t.id} className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
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
    </>
  )
}
