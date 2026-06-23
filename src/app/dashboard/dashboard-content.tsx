'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import {
  Car, User, Wrench, Package, Calendar, Plus, X,
  ChevronRight, AlertTriangle, CheckCircle, ClipboardList,
  ShieldCheck, Tag, Clock
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import {
  type Auftrag, type Hebebuehne, type FahrzeugStatus,
  FAHRZEUG_STATUS_LABEL, FAHRZEUG_STATUS_COLOR,
  TEIL_STATUS_LABEL, TEIL_STATUS_COLOR, type TeilStatus
} from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface BuehneExt extends Hebebuehne {
  position: number
  gesperrt: boolean
}

interface Props {
  hebebuehnen: BuehneExt[]
  auftraege: Auftrag[]
  offeneAuftraege: number
  wartendeTeile: number
  fertigeHeute: number
  ueberfaellig: number
  naechsteTermine: any[]
  eigenFahrzeuge: number
  tuevBuehnenTermine: any[]
}

const STATUS_ORDER: FahrzeugStatus[] = ['angenommen','diagnose','reparatur','warten_teile','fertig','ausgeliefert']

const TUEV_CFG = {
  bestanden: { label: 'Bestanden', color: 'bg-green-100 text-green-700 border-green-300' },
  nicht_bestanden: { label: 'Nicht bestanden', color: 'bg-red-100 text-red-700 border-red-300' },
  maengel: { label: 'Mit Mängeln', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
}

function isDialog(b: BuehneExt) {
  return b.bezeichnung.toLowerCase().includes('dialog')
}

export function DashboardContent({
  hebebuehnen: initBuehnen, auftraege: initAuftraege,
  offeneAuftraege, wartendeTeile, fertigeHeute, ueberfaellig, naechsteTermine, eigenFahrzeuge, tuevBuehnenTermine
}: Props) {
  const [buehnen, setBuehnen] = useState<BuehneExt[]>(initBuehnen)
  const [auftraege, setAuftraege] = useState<Auftrag[]>(initAuftraege)
  const [aufragDragId, setAuftragDragId] = useState<string | null>(null)
  const [dropOver, setDropOver] = useState<string | null>(null)
  const [detailBuehne, setDetailBuehne] = useState<{ buehne: BuehneExt; auftrag?: Auftrag } | null>(null)
  const supabase = createClient()

  // â”€â”€ Vehicle drag onto bay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function dropAuftrag(buehneId: string) {
    if (!aufragDragId) return
    setDropOver(null)
    setAuftraege(p => p.map(a => a.id === aufragDragId ? { ...a, hebebuehne_id: buehneId } : a))
    await supabase.from('auftraege').update({ hebebuehne_id: buehneId }).eq('id', aufragDragId)
    setAuftragDragId(null)
  }

  async function assignAuftrag(auftragId: string, buehneId: string) {
    setAuftraege(p => p.map(a => a.id === auftragId ? { ...a, hebebuehne_id: buehneId } : a))
    await supabase.from('auftraege').update({ hebebuehne_id: buehneId }).eq('id', auftragId)
  }

  async function freigeben(buehneId: string) {
    const a = auftraege.find(x => x.hebebuehne_id === buehneId)
    if (!a) return
    setAuftraege(p => p.map(x => x.id === a.id ? { ...x, hebebuehne_id: undefined } : x))
    await supabase.from('auftraege').update({ hebebuehne_id: null }).eq('id', a.id)
  }

  async function changeStatus(auftragId: string, status: FahrzeugStatus) {
    const freigeben = status === 'fertig' || status === 'ausgeliefert'
    setAuftraege(p => p.map(a => a.id === auftragId
      ? { ...a, status, hebebuehne_id: freigeben ? undefined : a.hebebuehne_id }
      : a
    ))
    const update: any = { status }
    if (freigeben) update.hebebuehne_id = null
    await supabase.from('auftraege').update(update).eq('id', auftragId)
  }

const auftragMap = new Map<string, Auftrag>()
  for (const a of auftraege) { if (a.hebebuehne_id) auftragMap.set(a.hebebuehne_id, a) }

  const today = new Date().toISOString().split('T')[0]
  // Map: buehne_id → nächster TÜV-Termin
  const tuevMap = new Map<string, any>()
  for (const t of tuevBuehnenTermine) {
    if (!tuevMap.has(t.hebebuehne_id)) tuevMap.set(t.hebebuehne_id, t)
  }

  const dialog = buehnen.find(b => isDialog(b))
  const normalBuehnen = buehnen.filter(b => !isDialog(b))
  const unassigned = auftraege.filter(a => !a.hebebuehne_id && !['fertig','ausgeliefert'].includes(a.status))

  const stats = [
    { label: 'Offene Aufträge', value: offeneAuftraege, icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50', href: '/fahrzeuge' },
    { label: 'Wartende Teile', value: wartendeTeile, icon: Package, color: 'text-yellow-600', bg: 'bg-yellow-50', href: '/fahrzeuge' },
    { label: 'Heute fertig', value: fertigeHeute, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', href: '/fahrzeuge' },
    { label: 'Überfällig', value: ueberfaellig, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', href: '/fahrzeuge' },
    { label: 'Lagerbestand', value: eigenFahrzeuge, icon: Tag, color: 'text-purple-600', bg: 'bg-purple-50', href: '/fahrzeuge' },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer"><CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-800">{label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
              </div>
            </CardContent></Card>
          </Link>
        ))}
      </div>

      {/* Dialogannahme */}
      {dialog && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-500" /> Dialogannahme
              <span className="ml-2 text-xs font-normal text-gray-500">(Fahrzeugannahme direkt beim Kunden)</span>
            </h2>
          </div>
          <BuehneCard
            buehne={dialog}
            auftrag={auftragMap.get(dialog.id)}
            tuevTermin={tuevMap.get(dialog.id)}
            isOver={dropOver === dialog.id}
            unassigned={unassigned}
            onAuftragDragOver={e => { e.preventDefault(); if (aufragDragId) setDropOver(dialog.id) }}
            onDragLeave={() => setDropOver(null)}
            onAuftragDrop={() => dropAuftrag(dialog.id)}
            onFreigeben={() => freigeben(dialog.id)}
            onStatusChange={changeStatus}
            onAuftragDragStart={id => setAuftragDragId(id)}
            onZuweisen={id => assignAuftrag(id, dialog.id)}
            onDetail={() => setDetailBuehne({ buehne: dialog, auftrag: auftragMap.get(dialog.id) })}
            isDialogCard
          />
        </div>
      )}

      {/* Hebebühnen */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Car className="w-5 h-5 text-orange-500" /> Hebebühnen
          </h2>
          <Link href="/hebebuehnen" className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Bühnen verwalten
          </Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {normalBuehnen.map(b => (
            <BuehneCard
              key={b.id}
              buehne={b}
              auftrag={auftragMap.get(b.id)}
              tuevTermin={tuevMap.get(b.id)}
              isOver={dropOver === b.id}
              unassigned={unassigned}
              onAuftragDragOver={e => { e.preventDefault(); if (aufragDragId) setDropOver(b.id) }}
              onDragLeave={() => setDropOver(null)}
              onAuftragDrop={() => dropAuftrag(b.id)}
              onFreigeben={() => freigeben(b.id)}
              onStatusChange={changeStatus}
              onAuftragDragStart={id => setAuftragDragId(id)}
              onZuweisen={id => assignAuftrag(id, b.id)}
              onDetail={() => setDetailBuehne({ buehne: b, auftrag: auftragMap.get(b.id) })}
            />
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Unassigned vehicles */}
        {unassigned.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-700 mb-3">Wartende Fahrzeuge <span className="text-gray-600 font-normal text-sm">— auf Bühne ziehen</span></h2>
            <div className="space-y-2">
              {unassigned.map(a => (
                <div
                  key={a.id}
                  draggable
                  onDragStart={() => setAuftragDragId(a.id)}
                  onDragEnd={() => setAuftragDragId(null)}
                  className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-orange-300 flex items-center gap-3 min-h-[56px]"
                >
                  <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
                    <Car className="w-4 h-4 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{a.fahrzeug?.marke} {a.fahrzeug?.modell}</p>
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-gray-600 font-mono">{a.fahrzeug?.kennzeichen}</p>
                      {a.fahrzeug?.fahrzeug_typ === 'eigen' && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 rounded">Lager</span>}
                    </div>
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border', FAHRZEUG_STATUS_COLOR[a.status])}>
                    {FAHRZEUG_STATUS_LABEL[a.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming appointments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" /> Nächste Termine
            </h2>
            <Link href="/termine" className="text-xs text-orange-600 hover:text-orange-700 font-medium">Alle anzeigen</Link>
          </div>
          {naechsteTermine.length === 0 ? (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 text-center text-gray-600">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Keine anstehenden Termine</p>
              <Link href="/termine"><button className="mt-2 text-xs text-orange-500">+ Termin anlegen</button></Link>
            </div>
          ) : (
            <div className="space-y-2">
              {naechsteTermine.map((t: any) => (
                <Link key={t.id} href="/termine">
                  <div className={cn('flex items-center gap-3 p-3 bg-white border rounded-xl hover:border-orange-300 transition-colors',
                    t.typ === 'tuev' ? 'border-yellow-200 bg-yellow-50/30' : 'border-gray-200')}>
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      t.typ === 'tuev' ? 'bg-yellow-100' : 'bg-blue-100')}>
                      {t.typ === 'tuev' ? <ShieldCheck className="w-5 h-5 text-yellow-600" /> : <Calendar className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.titel}</p>
                      <p className="text-xs text-gray-600">{formatDate(t.datum)}{t.uhrzeit ? ` · ${t.uhrzeit.slice(0,5)} Uhr` : ''}</p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', {
                      offen:'bg-gray-100 text-gray-600 border-gray-200',
                      bestaetigt:'bg-green-100 text-green-700 border-green-200',
                      erledigt:'bg-blue-100 text-blue-700 border-blue-200',
                      abgesagt:'bg-red-100 text-red-600 border-red-200'
                    }[t.status as string] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
                      {{offen:'Offen',bestaetigt:'Bestätigt',erledigt:'Erledigt',abgesagt:'Abgesagt'}[t.status as string] ?? t.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bühnen-Detail Drawer */}
      {detailBuehne && (
        <BuehneDetailDrawer
          buehne={detailBuehne.buehne}
          auftrag={detailBuehne.auftrag}
          onClose={() => setDetailBuehne(null)}
          onStatusChange={(id, s) => {
            changeStatus(id, s)
            setDetailBuehne(d => d ? { ...d, auftrag: d.auftrag ? { ...d.auftrag, status: s } : undefined } : null)
          }}
          onFreigeben={() => { freigeben(detailBuehne.buehne.id); setDetailBuehne(null) }}
        />
      )}
    </div>
  )
}

// â”€â”€ Bay card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BuehneCard({
  buehne, auftrag, tuevTermin, isOver, unassigned,
  onAuftragDragOver, onDragLeave,
  onAuftragDrop,
  onFreigeben, onStatusChange, onAuftragDragStart,
  onZuweisen, onDetail, isDialogCard = false,
}: {
  buehne: BuehneExt
  auftrag?: Auftrag
  tuevTermin?: any
  isOver: boolean
  unassigned: Auftrag[]
  onAuftragDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onAuftragDrop: () => void
  onFreigeben: () => void
  onStatusChange: (id: string, s: FahrzeugStatus) => void
  onAuftragDragStart: (id: string) => void
  onZuweisen: (auftragId: string) => void
  onDetail: () => void
  isDialogCard?: boolean
}) {
  const overdue = auftrag?.geplante_fertigstellung
    ? new Date(auftrag.geplante_fertigstellung) < new Date() && !['fertig','ausgeliefert'].includes(auftrag.status)
    : false

  const eigen = auftrag?.fahrzeug?.fahrzeug_typ === 'eigen'
  const accentColor = isDialogCard ? 'blue' : eigen ? 'purple' : 'orange'

  const headerBg = auftrag
    ? isDialogCard ? 'bg-blue-900 text-white border-blue-800' : 'bg-gray-900 text-white border-gray-800'
    : isDialogCard ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-gray-50 text-gray-600 border-gray-100'

  const borderColor = isOver
    ? 'border-orange-400 shadow-lg'
    : overdue ? 'border-red-300'
    : isDialogCard ? 'border-blue-200'
    : 'border-gray-200'

  return (
    <div
      onDragOver={onAuftragDragOver}
      onDragLeave={onDragLeave}
      onDrop={onAuftragDrop}
      className={cn(
        'rounded-xl border-2 bg-white overflow-hidden transition-all duration-150',
        borderColor,
      )}
    >
      {/* Header — klickbar für Detail-Drawer */}
      <div
        onClick={onDetail}
        className={cn('flex items-center justify-between px-4 py-3 border-b cursor-pointer select-none', headerBg)}
      >
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs',
            isDialogCard ? (auftrag ? 'bg-blue-500' : 'bg-blue-300')
              : (auftrag ? 'bg-orange-500' : 'bg-gray-300')
          )}>
            {isDialogCard ? <ClipboardList className="w-4 h-4" /> : buehne.nummer}
          </div>
          <span className="font-semibold text-sm">{buehne.bezeichnung}</span>
        </div>
        <div className="flex items-center gap-2">
          {auftrag ? (
            <><span className="text-xs opacity-60">Belegt</span>
            <button onClick={e => { e.stopPropagation(); onFreigeben() }} className="p-1 rounded hover:bg-red-500/20 opacity-50 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button></>
          ) : (
            <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">Frei</span>
          )}
          <ChevronRight className="w-4 h-4 opacity-40" />
        </div>
      </div>

      {/* TÜV-Reservierung Banner */}
      {tuevTermin && (() => {
        const today = new Date().toISOString().split('T')[0]
        const isHeute = tuevTermin.datum === today
        const isMorgen = tuevTermin.datum === new Date(Date.now() + 86400000).toISOString().split('T')[0]
        const label = isHeute ? 'Heute' : isMorgen ? 'Morgen' : new Date(tuevTermin.datum + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
        return (
          <div className={cn('flex items-center gap-2 px-4 py-2 text-xs font-medium border-b', isHeute ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-yellow-50 text-yellow-700 border-yellow-100')}>
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
            <span>TÜV reserviert · {label}{tuevTermin.uhrzeit ? ` · ${tuevTermin.uhrzeit.slice(0, 5)} Uhr` : ''}</span>
            {tuevTermin.fahrzeug && <span className="ml-auto font-mono opacity-70">{tuevTermin.fahrzeug.kennzeichen}</span>}
          </div>
        )
      })()}

      {/* Body */}
      <div className={cn('p-4', isDialogCard ? 'min-h-[100px]' : 'min-h-[280px]')}>
        {auftrag ? (
          <div
            draggable
            onDragStart={e => { e.stopPropagation(); onAuftragDragStart(auftrag.id) }}
            className="h-full cursor-grab active:cursor-grabbing"
          >
            {isDialogCard
              ? <AuftragCardCompact auftrag={auftrag} onStatusChange={s => onStatusChange(auftrag.id, s)} overdue={overdue} />
              : <AuftragCardFull auftrag={auftrag} onStatusChange={s => onStatusChange(auftrag.id, s)} overdue={overdue} accentColor={accentColor} />
            }
          </div>
        ) : (
          <EmptyBay compact={isDialogCard} unassigned={unassigned} onZuweisen={onZuweisen} />
        )}
      </div>
    </div>
  )
}

// â”€â”€ Lift visual (top-down) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LiftVisual({ color }: { color: string }) {
  const c = color === 'purple' ? '#9333ea' : color === 'blue' ? '#3b82f6' : '#f97316'
  return (
    <div className="flex justify-center mb-3">
      <svg width="120" height="180" viewBox="0 0 120 180" fill="none">
        {/* bay floor */}
        <rect x="8" y="8" width="104" height="164" rx="8" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="2"/>
        {/* lift rails */}
        <rect x="16" y="16" width="14" height="148" rx="4" fill={c} opacity="0.8"/>
        <rect x="90" y="16" width="14" height="148" rx="4" fill={c} opacity="0.8"/>
        {/* lift platforms */}
        <rect x="12" y="64" width="96" height="10" rx="3" fill={c} opacity="0.4"/>
        <rect x="12" y="106" width="96" height="10" rx="3" fill={c} opacity="0.4"/>
        {/* car body */}
        <rect x="34" y="38" width="52" height="104" rx="8" fill={c} opacity="0.85"/>
        {/* windshields */}
        <rect x="40" y="48" width="40" height="22" rx="4" fill="white" opacity="0.35"/>
        <rect x="40" y="110" width="40" height="18" rx="4" fill="white" opacity="0.2"/>
        {/* front lights */}
        <rect x="34" y="40" width="12" height="7" rx="2" fill="#fde68a"/>
        <rect x="74" y="40" width="12" height="7" rx="2" fill="#fde68a"/>
        {/* rear lights */}
        <rect x="34" y="133" width="12" height="7" rx="2" fill="#fca5a5"/>
        <rect x="74" y="133" width="12" height="7" rx="2" fill="#fca5a5"/>
        {/* wheels */}
        <rect x="26" y="48" width="10" height="22" rx="3" fill="#1f2937"/>
        <rect x="84" y="48" width="10" height="22" rx="3" fill="#1f2937"/>
        <rect x="26" y="110" width="10" height="22" rx="3" fill="#1f2937"/>
        <rect x="84" y="110" width="10" height="22" rx="3" fill="#1f2937"/>
      </svg>
    </div>
  )
}

function EmptyLiftVisual() {
  return (
    <div className="flex justify-center mb-3">
      <svg width="120" height="180" viewBox="0 0 120 180" fill="none">
        <rect x="8" y="8" width="104" height="164" rx="8" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="2" strokeDasharray="6 4"/>
        <rect x="16" y="16" width="14" height="148" rx="4" fill="#d1d5db"/>
        <rect x="90" y="16" width="14" height="148" rx="4" fill="#d1d5db"/>
        <rect x="12" y="64" width="96" height="10" rx="3" fill="#e5e7eb"/>
        <rect x="12" y="106" width="96" height="10" rx="3" fill="#e5e7eb"/>
        <text x="60" y="97" textAnchor="middle" fill="#9ca3af" fontSize="11" fontFamily="sans-serif">Frei</text>
      </svg>
    </div>
  )
}

// â”€â”€ Auftrag cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AuftragCardFull({ auftrag, onStatusChange, overdue, accentColor }: {
  auftrag: Auftrag; onStatusChange: (s: FahrzeugStatus) => void; overdue: boolean; accentColor: string
}) {
  const [showMenu, setShowMenu] = useState(false)
  const teile = auftrag.ersatzteile ?? []
  const eigen = auftrag.fahrzeug?.fahrzeug_typ === 'eigen'

  return (
    <div className="flex flex-col h-full">
      <LiftVisual color={accentColor} />
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <p className="font-bold text-gray-900 text-sm truncate">{auftrag.fahrzeug?.marke} {auftrag.fahrzeug?.modell}</p>
            {eigen && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">Lager</span>}
            {auftrag.tuev_kandidat && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200">TÜV</span>}
          </div>
          <p className="text-xs font-mono text-gray-800">{auftrag.fahrzeug?.kennzeichen}</p>
          {auftrag.kunde && <p className="text-xs text-gray-600"><User className="w-3 h-3 inline mr-0.5" />{auftrag.kunde.vorname} {auftrag.kunde.nachname}</p>}
        </div>
        <Link href={`/fahrzeuge/${auftrag.id}`} onClick={e=>e.stopPropagation()} className="text-gray-300 hover:text-orange-500">
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      {auftrag.arbeiten && <p className="text-xs text-gray-800 line-clamp-2 mb-2 flex items-start gap-1"><Wrench className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-600" />{auftrag.arbeiten}</p>}
      {auftrag.tuev_ergebnis && <div className={cn('text-xs px-2 py-0.5 rounded border mb-2 font-medium', TUEV_CFG[auftrag.tuev_ergebnis as keyof typeof TUEV_CFG]?.color)}>TÜV: {TUEV_CFG[auftrag.tuev_ergebnis as keyof typeof TUEV_CFG]?.label}</div>}
      {overdue && <p className="text-xs text-red-600 font-medium mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Überfällig</p>}
      <div className="relative mt-auto">
        <button onClick={e=>{e.stopPropagation();setShowMenu(v=>!v)}} className={cn('flex w-full items-center justify-center px-2.5 py-1.5 rounded-full text-xs font-semibold border', FAHRZEUG_STATUS_COLOR[auftrag.status])}>
          {FAHRZEUG_STATUS_LABEL[auftrag.status]}
        </button>
        {showMenu && (
          <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-20">
            {STATUS_ORDER.map(s=>(
              <button key={s} onClick={e=>{e.stopPropagation();onStatusChange(s);setShowMenu(false)}} className={cn('flex w-full items-center px-3 py-2 text-xs hover:bg-gray-50 gap-2', s===auftrag.status&&'font-semibold bg-gray-50')}>
                <span className={cn('inline-flex px-2 py-0.5 rounded-full border', FAHRZEUG_STATUS_COLOR[s])}>{FAHRZEUG_STATUS_LABEL[s]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {teile.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          {teile.slice(0,2).map(t=>(
            <div key={t.id} className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-gray-600 truncate max-w-[110px]">{t.bezeichnung}</span>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full border', TEIL_STATUS_COLOR[t.status as TeilStatus])}>{TEIL_STATUS_LABEL[t.status as TeilStatus]}</span>
            </div>
          ))}
          {teile.length>2 && <p className="text-xs text-gray-300">+{teile.length-2} weitere</p>}
        </div>
      )}
    </div>
  )
}

function AuftragCardCompact({ auftrag, onStatusChange, overdue }: {
  auftrag: Auftrag; onStatusChange: (s: FahrzeugStatus) => void; overdue: boolean
}) {
  const [showMenu, setShowMenu] = useState(false)
  const eigen = auftrag.fahrzeug?.fahrzeug_typ === 'eigen'
  return (
    <div className="flex items-center gap-4">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', eigen ? 'bg-purple-100' : 'bg-blue-100')}>
        <Car className={cn('w-6 h-6', eigen ? 'text-purple-600' : 'text-blue-600')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <p className="font-bold text-gray-900 text-sm truncate">{auftrag.fahrzeug?.marke} {auftrag.fahrzeug?.modell}</p>
          {eigen && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Eigen</span>}
          {auftrag.tuev_kandidat && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">TÜV</span>}
        </div>
        <p className="text-xs font-mono text-gray-800">{auftrag.fahrzeug?.kennzeichen}</p>
        {auftrag.arbeiten && <p className="text-xs text-gray-600 truncate mt-0.5">{auftrag.arbeiten}</p>}
        {overdue && <p className="text-xs text-red-600 font-medium"><AlertTriangle className="w-3 h-3 inline mr-0.5" />Überfällig</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative">
          <button onClick={e=>{e.stopPropagation();setShowMenu(v=>!v)}} className={cn('text-xs px-2.5 py-1.5 rounded-full border font-semibold', FAHRZEUG_STATUS_COLOR[auftrag.status])}>
            {FAHRZEUG_STATUS_LABEL[auftrag.status]}
          </button>
          {showMenu && (
            <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-20 min-w-[160px]">
              {STATUS_ORDER.map(s=>(
                <button key={s} onClick={e=>{e.stopPropagation();onStatusChange(s);setShowMenu(false)}} className={cn('flex w-full items-center px-3 py-2 text-xs hover:bg-gray-50', s===auftrag.status&&'font-semibold bg-gray-50')}>
                  <span className={cn('inline-flex px-2 py-0.5 rounded-full border', FAHRZEUG_STATUS_COLOR[s])}>{FAHRZEUG_STATUS_LABEL[s]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Link href={`/fahrzeuge/${auftrag.id}`} onClick={e=>e.stopPropagation()} className="text-gray-300 hover:text-blue-500">
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

function EmptyBay({ compact, unassigned, onZuweisen }: {
  compact: boolean
  unassigned: Auftrag[]
  onZuweisen: (auftragId: string) => void
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-gray-300 h-full', compact ? 'py-2' : '')}>
      {compact ? (
        <div className="flex items-center gap-3 w-full">
          <ClipboardList className="w-7 h-7 opacity-30 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-600">Frei</p>
            {unassigned.length > 0 ? (
              <select
                onChange={e => { if (e.target.value) onZuweisen(e.target.value) }}
                defaultValue=""
                onClick={e => e.stopPropagation()}
                className="mt-1 w-full text-xs border border-blue-200 rounded-lg px-2 py-1 text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              >
                <option value="">+ Fahrzeug zuweisen</option>
                {unassigned.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.fahrzeug?.marke} {a.fahrzeug?.modell} — {a.fahrzeug?.kennzeichen}
                  </option>
                ))}
              </select>
            ) : (
              <Link href="/fahrzeuge/neu"><button className="text-xs text-blue-500 hover:text-blue-600"><Plus className="w-3 h-3 inline" /> Fahrzeug annehmen</button></Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <EmptyLiftVisual />
          {unassigned.length > 0 ? (
            <div className="w-full mt-2 px-1">
              <select
                onChange={e => { if (e.target.value) onZuweisen(e.target.value) }}
                defaultValue=""
                onClick={e => e.stopPropagation()}
                className="w-full text-xs border border-orange-200 rounded-lg px-2.5 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
              >
                <option value="">+ Fahrzeug zuweisen</option>
                {unassigned.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.fahrzeug?.marke} {a.fahrzeug?.modell} — {a.fahrzeug?.kennzeichen || (a.fahrzeug as any)?.mobile_de_id || ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <Link href="/fahrzeuge/neu"><button className="text-xs text-orange-500 hover:text-orange-600 mt-1"><Plus className="w-3.5 h-3.5 inline mr-0.5" />Neues Fahrzeug</button></Link>
          )}
        </>
      )}
    </div>
  )
}

// ── Bühnen-Detail Drawer ──────────────────────────────────────────────────
function BuehneDetailDrawer({
  buehne, auftrag, onClose, onStatusChange, onFreigeben,
}: {
  buehne: BuehneExt
  auftrag?: Auftrag
  onClose: () => void
  onStatusChange: (id: string, s: FahrzeugStatus) => void
  onFreigeben: () => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const fertig = auftrag?.geplante_fertigstellung ? new Date(auftrag.geplante_fertigstellung) : null
  const diffDays = fertig ? Math.round((fertig.getTime() - today.getTime()) / 86400000) : null
  const overdue = diffDays !== null && diffDays < 0
  const teile = (auftrag?.ersatzteile ?? []) as any[]
  const offeneTeile = teile.filter(t => ['nicht_bestellt','bestellt','unterwegs'].includes(t.status))
  const eigen = (auftrag?.fahrzeug as any)?.fahrzeug_typ === 'eigen'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto lg:left-auto lg:top-0 lg:bottom-0 lg:right-0 lg:w-[420px] lg:rounded-none lg:rounded-l-2xl lg:max-h-full">
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold', auftrag ? 'bg-orange-500' : 'bg-gray-300')}>
              {buehne.nummer}
            </div>
            <div>
              <p className="font-bold text-gray-900">{buehne.bezeichnung}</p>
              <p className={cn('text-xs font-medium', auftrag ? 'text-orange-600' : 'text-green-600')}>{auftrag ? 'Belegt' : 'Frei'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        {auftrag ? (
          <div className="p-5 space-y-4">
            {/* Fahrzeug */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fahrzeug</p>
                {eigen && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Lagerbestand</span>}
              </div>
              <p className="text-xl font-bold text-gray-900">{(auftrag.fahrzeug as any)?.marke} {(auftrag.fahrzeug as any)?.modell}</p>
              <p className="text-sm font-mono text-gray-600 mt-0.5">{(auftrag.fahrzeug as any)?.kennzeichen}</p>
              {(auftrag.fahrzeug as any)?.baujahr && (
                <p className="text-xs text-gray-500 mt-1">Baujahr {(auftrag.fahrzeug as any).baujahr} · {(auftrag.fahrzeug as any)?.kilometerstand?.toLocaleString('de-DE')} km</p>
              )}
            </div>

            {/* Zeit-Status */}
            <div className={cn('rounded-xl p-4 border-2', overdue ? 'bg-red-50 border-red-200' : diffDays === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200')}>
              <p className={cn('text-xs font-semibold uppercase tracking-wide mb-1', overdue ? 'text-red-600' : diffDays === 0 ? 'text-yellow-600' : 'text-green-700')}>
                {overdue ? '⚠ Überfällig' : 'Fertigstellung'}
              </p>
              {fertig ? (
                <>
                  <p className="text-lg font-bold text-gray-900">{fertig.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  <p className={cn('text-sm font-medium mt-0.5', overdue ? 'text-red-600' : diffDays === 0 ? 'text-yellow-600' : 'text-green-700')}>
                    {overdue ? `${Math.abs(diffDays!)} Tag${Math.abs(diffDays!) !== 1 ? 'e' : ''} Überfällig`
                      : diffDays === 0 ? 'Heute fällig'
                      : `Noch ${diffDays} Tag${diffDays !== 1 ? 'e' : ''}`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Kein Termin gesetzt</p>
              )}
            </div>

            {/* Status */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_ORDER.map(s => (
                  <button key={s} onClick={() => onStatusChange(auftrag.id, s)}
                    className={cn('px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors', auftrag.status === s ? FAHRZEUG_STATUS_COLOR[s] : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400')}>
                    {FAHRZEUG_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Arbeiten */}
            {auftrag.arbeiten && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Arbeiten</p>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                  {auftrag.arbeiten.split('\n').filter(Boolean).map((l, i) => (
                    <p key={i} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />{l}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Ersatzteile */}
            {teile.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Ersatzteile ({teile.length}){offeneTeile.length > 0 && <span className="text-red-500 ml-1">· {offeneTeile.length} ausstehend</span>}
                </p>
                <div className="space-y-1.5">
                  {teile.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-sm text-gray-800 truncate">{t.bezeichnung}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border ml-2 flex-shrink-0', TEIL_STATUS_COLOR[t.status as TeilStatus])}>{TEIL_STATUS_LABEL[t.status as TeilStatus]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kunde */}
            {auftrag.kunde && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kunde</p>
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{auftrag.kunde.vorname} {auftrag.kunde.nachname}</p>
                    {(auftrag.kunde as any).telefon && <p className="text-xs text-gray-600">{(auftrag.kunde as any).telefon}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Aktionen */}
            <div className="flex gap-3 pt-2 pb-4">
              <Link href={`/fahrzeuge/${auftrag.id}`} className="flex-1">
                <button className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold transition-colors">
                  Auftrag öffnen
                </button>
              </Link>
              <button onClick={onFreigeben} className="px-4 py-3.5 border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold transition-colors">
                Freigeben
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Car className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">Bühne ist frei</p>
            <p className="text-sm text-gray-400 mt-1">Kein Fahrzeug zugewiesen</p>
          </div>
        )}
      </div>
    </>
  )
}
