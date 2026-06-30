'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Printer, Save, Fuel, Gauge, Euro, Camera, Upload, X, Trash2, Car, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type Firma = Record<string, string>

interface DamagePunkt {
  id: number
  x: number
  y: number
  notiz: string
}

type CheckStatus = 'ok' | 'nicht_ok' | null

interface CheckItem {
  id: string
  label: string
  gruppe: string
  status: CheckStatus
  notiz: string
}

interface AnnahmeFoto {
  id: string
  url: string
  storage_path: string
  beschreibung: string | null
}

const ZUSTAND_LABEL: Record<string, string> = {
  sehr_gut: 'Sehr gut',
  gut: 'Gut',
  maessig: 'Mäßig',
  schlecht: 'Schlecht',
}

const CHECKLISTE_ITEMS: Array<{ id: string; label: string; gruppe: string }> = [
  { id: 'licht_vl',      label: 'Licht vorne links',   gruppe: 'Beleuchtung' },
  { id: 'licht_vr',      label: 'Licht vorne rechts',  gruppe: 'Beleuchtung' },
  { id: 'licht_hl',      label: 'Licht hinten links',  gruppe: 'Beleuchtung' },
  { id: 'licht_hr',      label: 'Licht hinten rechts', gruppe: 'Beleuchtung' },
  { id: 'blinker',       label: 'Blinker (alle)',       gruppe: 'Beleuchtung' },
  { id: 'scheibe_v',     label: 'Windschutzscheibe',   gruppe: 'Scheiben' },
  { id: 'scheibe_h',     label: 'Heckscheibe',         gruppe: 'Scheiben' },
  { id: 'spiegel_l',     label: 'Spiegel links',       gruppe: 'Scheiben' },
  { id: 'spiegel_r',     label: 'Spiegel rechts',      gruppe: 'Scheiben' },
  { id: 'reifen_vl',     label: 'Reifen vorne links',  gruppe: 'Reifen & Räder' },
  { id: 'reifen_vr',     label: 'Reifen vorne rechts', gruppe: 'Reifen & Räder' },
  { id: 'reifen_hl',     label: 'Reifen hinten links', gruppe: 'Reifen & Räder' },
  { id: 'reifen_hr',     label: 'Reifen hinten rechts',gruppe: 'Reifen & Räder' },
  { id: 'stossstange_v', label: 'Stoßstange vorne',    gruppe: 'Karosserie' },
  { id: 'stossstange_h', label: 'Stoßstange hinten',   gruppe: 'Karosserie' },
  { id: 'motorhaube',    label: 'Motorhaube',          gruppe: 'Karosserie' },
  { id: 'heckklappe',    label: 'Heckklappe',          gruppe: 'Karosserie' },
  { id: 'innenraum',     label: 'Innenraum allg.',     gruppe: 'Innenraum' },
  { id: 'sitze',         label: 'Sitze',               gruppe: 'Innenraum' },
  { id: 'lenkrad',       label: 'Lenkrad',             gruppe: 'Innenraum' },
  { id: 'cockpit',       label: 'Armaturenbrett',      gruppe: 'Innenraum' },
]

function initCheckliste(saved: Record<string, { status: CheckStatus; notiz: string }> | null): CheckItem[] {
  return CHECKLISTE_ITEMS.map(item => ({
    ...item,
    status: saved?.[item.id]?.status ?? null,
    notiz: saved?.[item.id]?.notiz ?? '',
  }))
}

interface Props {
  auftrag: any
  firma: Firma
}

export function AnnahmeProtokoll({ auftrag, firma }: Props) {
  const [annahmeKm, setAnnahmeKm] = useState(String(auftrag.annahme_km ?? auftrag.fahrzeug?.kilometerstand ?? ''))
  const [annahmeTank, setAnnahmeTank] = useState<number>(auftrag.annahme_tank ?? 50)
  const [annahmeZustand, setAnnahmeZustand] = useState(auftrag.annahme_zustand ?? 'gut')
  const [kostenrahmen, setKostenrahmen] = useState(String(auftrag.kostenrahmen_max ?? ''))
  const [annahmeSchaeden, setAnnahmeSchaeden] = useState(auftrag.annahme_schaeden ?? '')

  const [damagePunkte, setDamagePunkte] = useState<DamagePunkt[]>(() => {
    const saved = auftrag.annahme_schadenspunkte
    return Array.isArray(saved) ? saved : []
  })
  const [selectedDamage, setSelectedDamage] = useState<number | null>(null)
  const [nextDamageId, setNextDamageId] = useState(() => {
    const saved = auftrag.annahme_schadenspunkte
    if (Array.isArray(saved) && saved.length > 0) return Math.max(...saved.map((d: DamagePunkt) => d.id)) + 1
    return 1
  })
  const svgRef = useRef<SVGSVGElement>(null)

  const [checkliste, setCheckliste] = useState<CheckItem[]>(() => initCheckliste(auftrag.annahme_checkliste))

  const [fotos, setFotos] = useState<AnnahmeFoto[]>([])
  const [uploading, setUploading] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const fotoGalleryRef = useRef<HTMLInputElement>(null)
  const [pendingFotos, setPendingFotos] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const [pendingBeschreibung, setPendingBeschreibung] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fahrzeug = auftrag.fahrzeug
  const kunde = auftrag.kunde
  const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  useEffect(() => {
    const sb = createClient()
    sb.from('auftrag_fotos')
      .select('id, url, storage_path, beschreibung')
      .eq('auftrag_id', auftrag.id)
      .eq('kategorie', 'annahme')
      .order('erstellt_am', { ascending: true })
      .then(({ data }) => { if (data) setFotos(data as AnnahmeFoto[]) })
  }, [auftrag.id])

  // --- Damage sketch ---
  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const xPct = ((e.clientX - rect.left) / rect.width) * 100
    const yPct = ((e.clientY - rect.top) / rect.height) * 100
    const newPunkt: DamagePunkt = { id: nextDamageId, x: xPct, y: yPct, notiz: '' }
    setDamagePunkte(prev => [...prev, newPunkt])
    setNextDamageId(n => n + 1)
    setSelectedDamage(newPunkt.id)
  }

  function removeDamage(id: number) {
    setDamagePunkte(prev => prev.filter(d => d.id !== id))
    if (selectedDamage === id) setSelectedDamage(null)
  }

  function updateDamageNotiz(id: number, notiz: string) {
    setDamagePunkte(prev => prev.map(d => d.id === id ? { ...d, notiz } : d))
  }

  // --- Checklist ---
  function toggleCheck(id: string, status: CheckStatus) {
    setCheckliste(prev => prev.map(item =>
      item.id === id ? { ...item, status: item.status === status ? null : status } : item
    ))
    setSaved(false)
  }

  function updateCheckNotiz(id: string, notiz: string) {
    setCheckliste(prev => prev.map(item => item.id === id ? { ...item, notiz } : item))
  }

  // --- Photo upload ---
  function handleFotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const arr = Array.from(files)
    const previews = arr.map(f => URL.createObjectURL(f))
    setPendingFotos(arr)
    setPendingPreviews(previews)
    setPendingBeschreibung('')
    if (e.target) e.target.value = ''
  }

  async function handlePendingUpload() {
    if (pendingFotos.length === 0) return
    const sb = createClient()
    setUploading(true)
    for (const file of pendingFotos) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `annahme/${auftrag.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await sb.storage.from('auftrag-fotos').upload(path, file)
      if (upErr) continue
      const { data: { publicUrl } } = sb.storage.from('auftrag-fotos').getPublicUrl(path)
      const { data: row } = await sb.from('auftrag_fotos').insert({
        auftrag_id: auftrag.id, url: publicUrl, storage_path: path, kategorie: 'annahme',
        beschreibung: pendingBeschreibung || null,
      }).select('id, url, storage_path, beschreibung').single()
      if (row) setFotos(prev => [...prev, row as AnnahmeFoto])
    }
    pendingPreviews.forEach(u => URL.revokeObjectURL(u))
    setPendingFotos([])
    setPendingPreviews([])
    setPendingBeschreibung('')
    setUploading(false)
  }

  function handlePendingCancel() {
    pendingPreviews.forEach(u => URL.revokeObjectURL(u))
    setPendingFotos([])
    setPendingPreviews([])
    setPendingBeschreibung('')
  }

  async function deleteFoto(foto: AnnahmeFoto) {
    const sb = createClient()
    await sb.storage.from('auftrag-fotos').remove([foto.storage_path])
    await sb.from('auftrag_fotos').delete().eq('id', foto.id)
    setFotos(prev => prev.filter(f => f.id !== foto.id))
  }

  // --- Save ---
  async function speichern(undDrucken = false) {
    const sb = createClient()
    setSaving(true)
    const checklisteData: Record<string, { status: CheckStatus; notiz: string }> = {}
    for (const item of checkliste) {
      if (item.status !== null || item.notiz) {
        checklisteData[item.id] = { status: item.status, notiz: item.notiz }
      }
    }
    await sb.from('auftraege').update({
      annahme_km: annahmeKm ? parseInt(annahmeKm) : null,
      annahme_tank: annahmeTank,
      annahme_schaeden: annahmeSchaeden || null,
      annahme_zustand: annahmeZustand,
      kostenrahmen_max: kostenrahmen ? parseFloat(kostenrahmen.replace(',', '.')) : null,
      annahme_datum: new Date().toISOString(),
      annahme_schadenspunkte: damagePunkte.length > 0 ? damagePunkte : null,
      annahme_checkliste: Object.keys(checklisteData).length > 0 ? checklisteData : null,
    }).eq('id', auftrag.id)
    setSaving(false)
    setSaved(true)
    if (undDrucken) window.print()
  }

  const tankStufen = [0, 25, 50, 75, 100]
  const gruppenKeys = Array.from(new Set(CHECKLISTE_ITEMS.map(i => i.gruppe)))
  const nichtOkItems = checkliste.filter(i => i.status === 'nicht_ok')

  // SVG viewBox is 0 0 160 340 → convert pct to viewBox coords
  const pctToSvg = (xPct: number, yPct: number) => ({
    cx: (xPct / 100) * 160,
    cy: (yPct / 100) * 340,
  })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="no-print bg-gray-50 min-h-screen pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white border-b px-4 flex items-center gap-3 topbar-safe">
          <Link href={`/fahrzeuge/${auftrag.id}`}>
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Zurück</Button>
          </Link>
          <h1 className="font-semibold text-gray-900 text-sm">Annahmeprotokoll</h1>
          <div className="ml-auto flex gap-2 py-3">
            <Button variant="outline" size="sm" onClick={() => speichern(false)} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />{saving ? '…' : saved ? '✓ OK' : 'Speichern'}
            </Button>
            <Button size="sm" onClick={() => speichern(true)} disabled={saving}>
              <Printer className="w-4 h-4 mr-1" />Drucken
            </Button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-4 space-y-4">

          {/* Grunddaten */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-orange-500" />
              <span className="font-semibold text-sm text-gray-800">Fahrzeugzustand</span>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Kilometerstand</label>
                  <input
                    type="number"
                    value={annahmeKm}
                    onChange={e => { setAnnahmeKm(e.target.value); setSaved(false) }}
                    placeholder="z.B. 85000"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Zustand</label>
                  <div className="flex gap-1">
                    {Object.entries(ZUSTAND_LABEL).map(([val, label]) => (
                      <button key={val} type="button" onClick={() => { setAnnahmeZustand(val); setSaved(false) }}
                        className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                          annahmeZustand === val
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'border-gray-200 text-gray-600 hover:border-orange-300'
                        )}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block flex items-center gap-1">
                  <Fuel className="w-3 h-3" /> Tankstand
                </label>
                <div className="flex gap-2">
                  {tankStufen.map(stufe => (
                    <button key={stufe} type="button" onClick={() => { setAnnahmeTank(stufe); setSaved(false) }}
                      className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                        annahmeTank === stufe
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 text-gray-600 hover:border-blue-300'
                      )}>
                      {stufe === 0 ? 'Leer' : stufe === 100 ? 'Voll' : `${stufe}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                  <Euro className="w-3 h-3 text-green-600" /> Kostenrahmen max. (€ brutto)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">bis max.</span>
                  <input
                    type="text"
                    value={kostenrahmen}
                    onChange={e => { setKostenrahmen(e.target.value); setSaved(false) }}
                    placeholder="z.B. 450,00"
                    className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <span className="text-sm text-gray-400">€</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Bei Mehrkosten: Rücksprache mit Auftraggeber (§ 632a BGB)</p>
              </div>
            </div>
          </div>

          {/* Fahrzeugskizze */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Car className="w-4 h-4 text-orange-500" />
              <span className="font-semibold text-sm text-gray-800">Schadensskizze</span>
              <span className="text-xs text-gray-400 ml-auto hidden sm:block">Auf die Skizze tippen um Schaden zu markieren</span>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-400 mb-3 sm:hidden">Auf die Skizze tippen um Schaden zu markieren</p>
              <div className="flex gap-4 flex-col sm:flex-row">
                {/* SVG Car sketch */}
                <div className="flex-shrink-0 flex justify-center">
                  <svg
                    ref={svgRef}
                    viewBox="0 0 160 340"
                    width="130"
                    height="276"
                    onClick={handleSvgClick}
                    className="cursor-crosshair select-none"
                    style={{ touchAction: 'none' }}
                  >
                    {/* Car body */}
                    <rect x="18" y="48" width="124" height="244" rx="22" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" />
                    {/* Front bumper */}
                    <rect x="28" y="20" width="104" height="34" rx="10" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" />
                    <text x="80" y="40" textAnchor="middle" fontSize="7" fill="#6b7280" fontWeight="600">VORNE</text>
                    {/* Rear bumper */}
                    <rect x="28" y="286" width="104" height="34" rx="10" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" />
                    <text x="80" y="307" textAnchor="middle" fontSize="7" fill="#6b7280" fontWeight="600">HINTEN</text>
                    {/* Front windshield */}
                    <rect x="32" y="58" width="96" height="44" rx="6" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1.5" />
                    {/* Rear windshield */}
                    <rect x="32" y="238" width="96" height="44" rx="6" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1.5" />
                    {/* Roof area */}
                    <rect x="28" y="108" width="104" height="124" rx="6" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1" />
                    {/* Wheels */}
                    <rect x="2" y="65" width="18" height="36" rx="4" fill="#374151" />
                    <rect x="140" y="65" width="18" height="36" rx="4" fill="#374151" />
                    <rect x="2" y="239" width="18" height="36" rx="4" fill="#374151" />
                    <rect x="140" y="239" width="18" height="36" rx="4" fill="#374151" />
                    {/* Side labels */}
                    <text x="10" y="172" textAnchor="middle" fontSize="6" fill="#9ca3af" transform="rotate(-90 10 172)">LINKS</text>
                    <text x="150" y="172" textAnchor="middle" fontSize="6" fill="#9ca3af" transform="rotate(90 150 172)">RECHTS</text>
                    {/* Damage markers */}
                    {damagePunkte.map(p => {
                      const { cx, cy } = pctToSvg(p.x, p.y)
                      return (
                        <g key={p.id} onClick={e => { e.stopPropagation(); setSelectedDamage(p.id === selectedDamage ? null : p.id) }} style={{ cursor: 'pointer' }}>
                          <circle cx={cx} cy={cy} r="10" fill={p.id === selectedDamage ? '#dc2626' : '#ef4444'} stroke="white" strokeWidth="2" opacity="0.95" />
                          <text x={cx} y={cy + 4} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold" pointerEvents="none">{p.id}</text>
                        </g>
                      )
                    })}
                  </svg>
                </div>

                {/* Damage list */}
                <div className="flex-1 min-w-0">
                  {damagePunkte.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">Noch keine Schäden markiert</p>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {damagePunkte.map(p => (
                        <div key={p.id} className={cn(
                          'rounded-lg border p-2 transition-colors',
                          selectedDamage === p.id ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
                        )}>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{p.id}</span>
                            <input
                              type="text"
                              value={p.notiz}
                              onChange={e => updateDamageNotiz(p.id, e.target.value)}
                              placeholder="Schadensbeschreibung..."
                              className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-red-300 bg-white"
                            />
                            <button onClick={() => removeDamage(p.id)} className="text-gray-400 hover:text-red-500 p-0.5">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={annahmeSchaeden}
                    onChange={e => { setAnnahmeSchaeden(e.target.value); setSaved(false) }}
                    placeholder="Weitere Anmerkungen zu Schäden, Gerüchen, Geräuschen..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sichtprüfung Checkliste */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-orange-500" />
              <span className="font-semibold text-sm text-gray-800">Sichtprüfung</span>
              {nichtOkItems.length > 0 && (
                <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                  {nichtOkItems.length} nicht i.O.
                </span>
              )}
            </div>
            <div className="p-4 space-y-4">
              {gruppenKeys.map(gruppe => (
                <div key={gruppe}>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{gruppe}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {checkliste.filter(item => item.gruppe === gruppe).map(item => (
                      <div key={item.id} className={cn(
                        'rounded-lg border p-2',
                        item.status === 'ok' ? 'border-green-200 bg-green-50' :
                        item.status === 'nicht_ok' ? 'border-red-200 bg-red-50' : 'border-gray-200'
                      )}>
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-xs text-gray-700 font-medium truncate">{item.label}</span>
                          <button
                            type="button"
                            onClick={() => toggleCheck(item.id, 'ok')}
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-semibold border transition-colors flex-shrink-0',
                              item.status === 'ok' ? 'bg-green-600 text-white border-green-600' : 'border-green-300 text-green-700 hover:bg-green-50'
                            )}>
                            i.O.
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCheck(item.id, 'nicht_ok')}
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-semibold border transition-colors flex-shrink-0',
                              item.status === 'nicht_ok' ? 'bg-red-600 text-white border-red-600' : 'border-red-300 text-red-700 hover:bg-red-50'
                            )}>
                            n.i.O.
                          </button>
                        </div>
                        {item.status === 'nicht_ok' && (
                          <input
                            type="text"
                            value={item.notiz}
                            onChange={e => updateCheckNotiz(item.id, e.target.value)}
                            placeholder="Beschreibung..."
                            className="mt-1.5 w-full text-xs px-2 py-1 border border-red-200 rounded focus:outline-none focus:ring-1 focus:ring-red-300 bg-white"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fotos */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Camera className="w-4 h-4 text-orange-500" />
              <span className="font-semibold text-sm text-gray-800">Fotos</span>
              {fotos.length > 0 && (
                <span className="text-xs text-gray-400">({fotos.length})</span>
              )}
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-3">
                <label htmlFor="annahme-foto-cam"
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-sm cursor-pointer hover:bg-orange-100 transition-colors font-medium">
                  <Camera className="w-4 h-4" />Kamera
                </label>
                <input ref={fotoInputRef} id="annahme-foto-cam" type="file" accept="image/*" capture="environment" onChange={handleFotoSelected} className="hidden" />
                <label htmlFor="annahme-foto-gallery"
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-sm cursor-pointer hover:bg-gray-100 transition-colors font-medium">
                  <Upload className="w-4 h-4" />Galerie
                </label>
                <input ref={fotoGalleryRef} id="annahme-foto-gallery" type="file" accept="image/*" multiple onChange={handleFotoSelected} className="hidden" />
              </div>
              {uploading && <p className="text-xs text-gray-500 mb-2 animate-pulse">Wird hochgeladen…</p>}
              {fotos.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {fotos.map(foto => (
                    <div key={foto.id} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img src={foto.url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => deleteFoto(foto)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : !uploading && (
                <p className="text-xs text-gray-400 italic">Noch keine Fotos – ideal für Vorschäden und Zustandsdokumentation</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Foto-Beschreibungs-Modal */}
      {pendingFotos.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-white rounded-t-2xl w-full max-w-lg shadow-xl p-5 space-y-4" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-base">
                {pendingFotos.length === 1 ? 'Foto hinzufügen' : `${pendingFotos.length} Fotos hinzufügen`}
              </h2>
              <button onClick={handlePendingCancel} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vorschau */}
            <div className={pendingPreviews.length === 1 ? '' : 'grid grid-cols-3 gap-2'}>
              {pendingPreviews.map((url, i) => (
                <div key={i} className={cn(
                  'rounded-xl overflow-hidden border border-gray-200',
                  pendingPreviews.length === 1 ? 'w-full aspect-video' : 'aspect-square'
                )}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            {/* Beschreibung */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Kurzbeschreibung (optional)</label>
              <input
                type="text"
                value={pendingBeschreibung}
                onChange={e => setPendingBeschreibung(e.target.value)}
                placeholder="z.B. Delle hinten links, Kratzer Stoßstange..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                autoFocus
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button onClick={handlePendingCancel}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">
                Abbrechen
              </button>
              <button onClick={handlePendingUpload} disabled={uploading}
                className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 transition-colors disabled:opacity-60">
                {uploading ? 'Wird hochgeladen…' : 'Hochladen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DRUCKANSICHT ===== */}
      <div className="print-page hidden print:block bg-white p-10 max-w-[210mm] mx-auto text-sm font-sans">
        {/* Kopfzeile */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-900">
          <div>
            <div className="text-xl font-bold text-gray-900">{firma.firma_name || 'Kfz-Werkstatt'}</div>
            {firma.firma_strasse && <div className="text-gray-600">{firma.firma_strasse}</div>}
            {(firma.firma_plz || firma.firma_ort) && <div className="text-gray-600">{firma.firma_plz} {firma.firma_ort}</div>}
            {firma.firma_telefon && <div className="text-gray-600">Tel.: {firma.firma_telefon}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-600 mb-1">ANNAHMEPROTOKOLL</div>
            <div className="text-gray-600">Auftrag: <strong>{auftrag.auftrag_nr}</strong></div>
            <div className="text-gray-600">Datum: <strong>{heute}</strong></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <div className="font-bold text-gray-800 mb-2 pb-1 border-b border-gray-300">Kunde</div>
            {kunde ? (
              <div className="space-y-0.5 text-gray-700">
                <div className="font-semibold">{kunde.vorname} {kunde.nachname}</div>
                {kunde.firma && <div>{kunde.firma}</div>}
                {kunde.strasse && <div>{kunde.strasse}</div>}
                {(kunde.plz || kunde.ort) && <div>{kunde.plz} {kunde.ort}</div>}
                {kunde.telefon && <div>Tel.: {kunde.telefon}</div>}
              </div>
            ) : <div className="text-gray-400">Kein Kunde zugewiesen</div>}
          </div>
          <div>
            <div className="font-bold text-gray-800 mb-2 pb-1 border-b border-gray-300">Fahrzeug</div>
            {fahrzeug && (
              <div className="space-y-0.5 text-gray-700">
                <div className="font-semibold">{fahrzeug.marke} {fahrzeug.modell}</div>
                {fahrzeug.kennzeichen && <div>Kennzeichen: <strong>{fahrzeug.kennzeichen}</strong></div>}
                {fahrzeug.baujahr && <div>Baujahr: {fahrzeug.baujahr}</div>}
                {fahrzeug.farbe && <div>Farbe: {fahrzeug.farbe}</div>}
                {fahrzeug.fahrgestellnummer && <div className="text-xs text-gray-500">FIN: {fahrzeug.fahrgestellnummer}</div>}
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="font-bold text-gray-800 mb-2 pb-1 border-b border-gray-300">Fahrzeugzustand bei Annahme</div>
          <div className="grid grid-cols-3 gap-4">
            <div><span className="text-gray-500">Kilometerstand:</span> <strong>{annahmeKm ? parseInt(annahmeKm).toLocaleString('de-DE') + ' km' : '—'}</strong></div>
            <div><span className="text-gray-500">Tankstand:</span> <strong>{annahmeTank === 0 ? 'Leer' : annahmeTank === 100 ? 'Voll' : `ca. ${annahmeTank}%`}</strong></div>
            <div><span className="text-gray-500">Zustand:</span> <strong>{ZUSTAND_LABEL[annahmeZustand] ?? annahmeZustand}</strong></div>
          </div>
          {annahmeSchaeden && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-gray-700">
              <strong>Anmerkungen: </strong>{annahmeSchaeden}
            </div>
          )}
        </div>

        {damagePunkte.length > 0 && (
          <div className="mb-4">
            <div className="font-bold text-gray-800 mb-2 pb-1 border-b border-gray-300">Schadensstellen</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {damagePunkte.map(p => (
                <div key={p.id} className="flex items-start gap-1.5 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">{p.id}</span>
                  <span>{p.notiz || '(keine Beschreibung)'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="font-bold text-gray-800 mb-2 pb-1 border-b border-gray-300">Sichtprüfung</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
            {checkliste.map(item => (
              <div key={item.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                <span className={cn('font-bold',
                  item.status === 'ok' ? 'text-green-600' :
                  item.status === 'nicht_ok' ? 'text-red-600' : 'text-gray-300'
                )}>
                  {item.status === 'ok' ? '✓' : item.status === 'nicht_ok' ? '✗' : '○'}
                </span>
                <span className={item.status === 'nicht_ok' ? 'font-semibold text-red-700' : ''}>{item.label}</span>
                {item.status === 'nicht_ok' && item.notiz && <span className="text-gray-500">({item.notiz})</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="font-bold text-gray-800 mb-2 pb-1 border-b border-gray-300">Vereinbarte Arbeiten</div>
          <div className="whitespace-pre-line text-gray-700 min-h-[50px]">{auftrag.arbeiten || '—'}</div>
        </div>

        <div className="mb-5 p-3 border-2 border-gray-800 rounded">
          <div className="font-bold text-gray-800 mb-1">Kostenvoranschlag (§ 632a BGB)</div>
          <div className="text-gray-700">
            Die Reparaturkosten werden voraussichtlich <strong>bis max.{' '}
            {kostenrahmen
              ? parseFloat(kostenrahmen.replace(',', '.')).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €'
              : '___________'} (brutto)</strong> betragen.
            Bei absehbaren Mehrkosten wird der Auftraggeber vorab kontaktiert und um Zustimmung gebeten.
          </div>
          {auftrag.geplante_fertigstellung && (
            <div className="text-gray-700 mt-1">
              Voraussichtliche Fertigstellung:{' '}
              <strong>{new Date(auftrag.geplante_fertigstellung + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</strong>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-8 mt-10">
          <div><div className="border-t border-gray-400 pt-2 text-gray-500 text-xs">Ort, Datum / Unterschrift Auftraggeber</div></div>
          <div><div className="border-t border-gray-400 pt-2 text-gray-500 text-xs">Ort, Datum / Unterschrift Werkstatt</div></div>
        </div>

        <div className="mt-8 text-xs text-gray-400 border-t pt-3">
          Mit Ihrer Unterschrift bestätigen Sie die Richtigkeit der Fahrzeugdaten und beauftragen die oben genannten Arbeiten
          zum angegebenen Kostenrahmen. Es gelten die allgemeinen Geschäftsbedingungen des Kraftfahrzeuggewerbes (AGB KFG).
        </div>
      </div>
    </>
  )
}
