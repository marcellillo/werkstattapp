'use client'
// Schnell-Annahme in EINEM Schritt: Kilometerstand, Tankstand, Vorschäden, Rundum-Fotos und (optional) Unterschrift des Kunden
// direkt auf dem Handy. Schreibt in dieselben Felder wie das ausführliche Annahmeprotokoll (das bleibt für den Ausdruck bestehen).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Check, Eraser, Fuel, Loader2, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface AnnahmeDaten {
  annahme_km: number | null
  annahme_tank: number | null
  annahme_schaeden: string | null
  annahme_datum: string
  annahme_unterschrift_kunde: string | null
}

interface Props {
  auftragId: string
  betriebId: string
  fahrzeugId?: string
  kundeName: string
  fahrzeugName: string
  start: { km: number | null; tank: number | null; schaeden: string | null; hatUnterschrift: boolean }
  onClose: () => void
  onGespeichert: (daten: AnnahmeDaten) => void
}

interface FotoZeile { id: string }
interface Neu { datei: File; vorschau: string }

const TANK = [0, 25, 50, 75, 100]
const MAX_FOTOS = 12

/** Handyfotos (3–5 MB) vor dem Hochladen auf ca. 1600 px / JPEG verkleinern: schneller und platzsparend. Bei Fehlern das Original. */
async function verkleinern(datei: File, maxSeite = 1600, qualitaet = 0.82): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(datei)
    const f = Math.min(1, maxSeite / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(bmp.width * f)); c.height = Math.max(1, Math.round(bmp.height * f))
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', qualitaet))
    return blob ?? datei
  } catch {
    return datei
  }
}

export function AnnahmeDialog({ auftragId, betriebId, fahrzeugId, kundeName, fahrzeugName, start, onClose, onGespeichert }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [km, setKm] = useState(start.km != null ? String(start.km) : '')
  const [tank, setTank] = useState<number | null>(start.tank)
  const [schaeden, setSchaeden] = useState(start.schaeden ?? '')
  const [vorhandene, setVorhandene] = useState<FotoZeile[]>([])
  const [neue, setNeue] = useState<Neu[]>([])
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const fotoEingabe = useRef<HTMLInputElement>(null)

  // Unterschriftenfeld
  const leinwand = useRef<HTMLCanvasElement>(null)
  const zeichnet = useRef(false)
  const [unterschrieben, setUnterschrieben] = useState(false)

  useEffect(() => {
    supabase.from('auftrag_fotos').select('id').eq('auftrag_id', auftragId).eq('kategorie', 'annahme').order('erstellt_am')
      .then(({ data }) => setVorhandene((data ?? []) as FotoZeile[]))
  }, [supabase, auftragId])
  useEffect(() => () => { neue.forEach(n => URL.revokeObjectURL(n.vorschau)) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = leinwand.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr
    const g = c.getContext('2d')!
    g.scale(dpr, dpr); g.lineWidth = 2.5; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#111827'
  }, [])

  const punkt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const beginnen = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    zeichnet.current = true
    const g = e.currentTarget.getContext('2d')!, p = punkt(e)
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + 0.01, p.y + 0.01); g.stroke()
    setUnterschrieben(true)
  }
  const ziehen = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!zeichnet.current) return
    const g = e.currentTarget.getContext('2d')!, p = punkt(e)
    g.lineTo(p.x, p.y); g.stroke()
  }
  const beenden = () => { zeichnet.current = false }
  const loeschen = () => {
    const c = leinwand.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setUnterschrieben(false)
  }

  function fotosGewaehlt(e: React.ChangeEvent<HTMLInputElement>) {
    const dateien = Array.from(e.target.files ?? [])
    e.target.value = ''
    const platz = MAX_FOTOS - vorhandene.length - neue.length
    setNeue(prev => [...prev, ...dateien.slice(0, Math.max(0, platz)).map(d => ({ datei: d, vorschau: URL.createObjectURL(d) }))])
    if (dateien.length > platz) setFehler(`Höchstens ${MAX_FOTOS} Fotos je Annahme.`)
  }

  async function speichern() {
    const kmZahl = km.trim() === '' ? null : Number(km.replace(/\./g, '').replace(',', '.'))
    if (kmZahl !== null && !(Number.isInteger(kmZahl) && kmZahl >= 0 && kmZahl <= 2_000_000)) { setFehler('Bitte einen gültigen Kilometerstand eintragen.'); return }
    if (kmZahl === null) { setFehler('Bitte den Kilometerstand eintragen.'); return }
    setSpeichert(true); setFehler(null)
    try {
      // Fotos: verkleinert in den Foto-Speicher + Verknüpfung zum Auftrag
      let hochgeladen = 0
      for (const n of neue) {
        const blob = await verkleinern(n.datei)
        const pfad = `annahme/${auftragId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
        const { error: upErr } = await supabase.storage.from('auftrag-fotos').upload(pfad, blob, { contentType: blob.type || 'image/jpeg' })
        if (upErr) { console.error('Annahme-Foto-Upload fehlgeschlagen:', upErr); continue }
        const { data: { publicUrl } } = supabase.storage.from('auftrag-fotos').getPublicUrl(pfad)
        const { error } = await supabase.from('auftrag_fotos').insert({ betrieb_id: betriebId, auftrag_id: auftragId, url: publicUrl, storage_path: pfad, kategorie: 'annahme', beschreibung: null })
        if (!error) hochgeladen++
      }
      if (neue.length > hochgeladen) throw new Error(`${neue.length - hochgeladen} Foto(s) konnten nicht hochgeladen werden — bitte erneut versuchen (die übrigen Angaben wurden noch nicht gespeichert).`)

      const daten: AnnahmeDaten = {
        annahme_km: kmZahl,
        annahme_tank: tank,
        annahme_schaeden: schaeden.trim() || null,
        annahme_datum: new Date().toISOString(),
        annahme_unterschrift_kunde: unterschrieben ? leinwand.current!.toDataURL('image/png') : null,
      }
      const { error } = await supabase.from('auftraege').update({
        annahme_km: daten.annahme_km, annahme_tank: daten.annahme_tank, annahme_schaeden: daten.annahme_schaeden, annahme_datum: daten.annahme_datum,
        ...(daten.annahme_unterschrift_kunde ? { annahme_unterschrift_kunde: daten.annahme_unterschrift_kunde } : {}),
      }).eq('id', auftragId)
      if (error) throw error
      if (fahrzeugId) await supabase.from('fahrzeuge').update({ kilometerstand: kmZahl }).eq('id', fahrzeugId)
      onGespeichert({ ...daten, annahme_unterschrift_kunde: daten.annahme_unterschrift_kunde ?? (start.hatUnterschrift ? 'vorhanden' : null) })
      onClose()
    } catch (e: any) {
      setFehler(e?.message ?? 'Die Annahme konnte nicht gespeichert werden.')
      setSpeichert(false)
    }
  }

  const anzahlFotos = vorhandene.length + neue.length
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col" role="dialog" aria-label="Fahrzeugannahme">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">Fahrzeug annehmen</p>
            <p className="text-xs text-slate-500 truncate">{[fahrzeugName, kundeName].filter(Boolean).join(' · ')}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Schließen"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Kilometerstand *</label>
            <input value={km} onChange={e => setKm(e.target.value)} inputMode="numeric" placeholder="z. B. 142000" autoFocus
              className="w-full px-3 py-3 border border-slate-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1"><Fuel className="w-4 h-4" /> Tankstand</label>
            <div className="grid grid-cols-5 gap-2">
              {TANK.map(t => (
                <button key={t} type="button" onClick={() => setTank(t)}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${tank === t ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-orange-300'}`}>
                  {t === 0 ? 'Leer' : t === 100 ? 'Voll' : `${t} %`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Vorschäden / Auffälligkeiten</label>
            <textarea value={schaeden} onChange={e => setSchaeden(e.target.value)} rows={2} maxLength={1000} placeholder="z. B. Kratzer Stoßfänger hinten links, Steinschlag Scheibe"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <button type="button" onClick={() => setSchaeden('Keine Vorschäden erkennbar')} className="mt-1 text-xs text-slate-500 hover:text-orange-600">Keine Vorschäden erkennbar</button>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1"><Camera className="w-4 h-4" /> Fotos ({anzahlFotos})</label>
            <p className="text-xs text-slate-500 mb-2">Am besten 4 Fotos rundherum (vorne, hinten, links, rechts) — schützt bei Streit über Schäden.</p>
            <div className="grid grid-cols-4 gap-2">
              {vorhandene.map(f => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f.id} src={`/api/auftrag-foto/datei?id=${f.id}`} alt="Annahmefoto" className="aspect-square w-full object-cover rounded-lg border border-slate-200" />
              ))}
              {neue.map((n, i) => (
                <div key={n.vorschau} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={n.vorschau} alt="Neues Foto" className="aspect-square w-full object-cover rounded-lg border border-orange-300" />
                  <button type="button" onClick={() => { URL.revokeObjectURL(n.vorschau); setNeue(prev => prev.filter((_, k) => k !== i)) }}
                    className="absolute -top-1.5 -right-1.5 bg-white border border-slate-200 rounded-full p-1 shadow" aria-label="Foto entfernen"><Trash2 className="w-3 h-3 text-red-500" /></button>
                </div>
              ))}
              {anzahlFotos < MAX_FOTOS && (
                <button type="button" onClick={() => fotoEingabe.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-orange-400 flex flex-col items-center justify-center text-slate-500 hover:text-orange-600 text-xs gap-1">
                  <Camera className="w-6 h-6" /> Foto
                </button>
              )}
            </div>
            <input ref={fotoEingabe} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={fotosGewaehlt} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">Unterschrift des Kunden <span className="text-slate-400 font-normal">(optional)</span></label>
              <button type="button" onClick={loeschen} className="text-xs text-slate-500 hover:text-red-600 inline-flex items-center gap-1"><Eraser className="w-3.5 h-3.5" /> Löschen</button>
            </div>
            <canvas ref={leinwand} onPointerDown={beginnen} onPointerMove={ziehen} onPointerUp={beenden} onPointerCancel={beenden}
              className="w-full h-36 rounded-xl border border-slate-300 bg-slate-50 touch-none" style={{ touchAction: 'none' }} aria-label="Unterschriftenfeld" />
            <p className="text-xs text-slate-500 mt-1">Mit der Unterschrift bestätigt {kundeName || 'der Kunde'} den hier festgehaltenen Zustand des Fahrzeugs bei der Annahme.
              {start.hatUnterschrift && !unterschrieben ? ' Es ist bereits eine Unterschrift gespeichert — sie bleibt, wenn Sie hier nicht neu unterschreiben.' : ''}</p>
          </div>

          {fehler && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fehler}</p>}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50">Später</button>
          <button onClick={speichern} disabled={speichert}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-60">
            {speichert ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird gespeichert …</> : <><Check className="w-4 h-4" /> Annahme speichern</>}
          </button>
        </div>
      </div>
    </div>
  )
}
