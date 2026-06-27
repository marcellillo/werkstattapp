'use client'
import { useState, useRef } from 'react'
import { Camera, Upload, Trash2, X, ZoomIn, Plus, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Foto = {
  id: string
  url: string
  storage_path: string
  kategorie: 'annahme' | 'reparatur' | 'fertig' | 'allgemein'
  beschreibung: string | null
  erstellt_am: string
}

const KATEGORIEN = [
  { value: 'annahme',   label: 'Annahme',   color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'reparatur', label: 'Reparatur',  color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'fertig',    label: 'Fertig',     color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'allgemein', label: 'Allgemein',  color: 'bg-gray-100 text-gray-700 border-gray-300' },
] as const

interface Props {
  auftragId: string
  initialFotos: Foto[]
}

export function FotosContent({ auftragId, initialFotos }: Props) {
  const supabase = createClient()
  const [fotos, setFotos] = useState<Foto[]>(initialFotos)
  const [uploading, setUploading] = useState(false)
  const [aktivKategorie, setAktivKategorie] = useState<Foto['kategorie']>('annahme')
  const [lightbox, setLightbox] = useState<Foto | null>(null)
  const [beschreibung, setBeschreibung] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${auftragId}/${aktivKategorie}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('auftrag-fotos').upload(path, file)
      if (upErr) { console.error(upErr); continue }
      const { data: { publicUrl } } = supabase.storage.from('auftrag-fotos').getPublicUrl(path)
      const { data: row } = await supabase.from('auftrag_fotos').insert({
        auftrag_id: auftragId,
        storage_path: path,
        url: publicUrl,
        kategorie: aktivKategorie,
        beschreibung: beschreibung || null,
      }).select().single()
      if (row) setFotos(prev => [...prev, row as Foto])
    }
    setBeschreibung('')
    setUploading(false)
  }

  async function loeschen(foto: Foto) {
    await supabase.storage.from('auftrag-fotos').remove([foto.storage_path])
    await supabase.from('auftrag_fotos').delete().eq('id', foto.id)
    setFotos(prev => prev.filter(f => f.id !== foto.id))
    if (lightbox?.id === foto.id) setLightbox(null)
  }

  const fotosByKat = (kat: Foto['kategorie']) => fotos.filter(f => f.kategorie === kat)

  return (
    <div className="space-y-6">
      {/* Upload Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="w-5 h-5 text-orange-500" />
            Foto hinzufügen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Kategorie wählen */}
          <div>
            <p className="text-xs text-gray-600 mb-2">Kategorie</p>
            <div className="flex gap-2 flex-wrap">
              {KATEGORIEN.map(k => (
                <button
                  key={k.value}
                  onClick={() => setAktivKategorie(k.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    aktivKategorie === k.value ? k.color : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {/* Beschreibung */}
          <input
            type="text"
            value={beschreibung}
            onChange={e => setBeschreibung(e.target.value)}
            placeholder="Kurze Beschreibung (optional)"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />

          {/* Upload Buttons */}
          <div className="flex gap-2">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            <Button variant="outline" className="flex-1" onClick={() => cameraRef.current?.click()} disabled={uploading}>
              <Camera className="w-4 h-4 mr-2" />Kamera
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="w-4 h-4 mr-2" />Galerie / Datei
            </Button>
          </div>
          {uploading && <p className="text-xs text-orange-600 text-center">Wird hochgeladen…</p>}
        </CardContent>
      </Card>

      {/* Fotos nach Kategorie */}
      {KATEGORIEN.map(kat => {
        const items = fotosByKat(kat.value)
        if (items.length === 0) return null
        return (
          <Card key={kat.value}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${kat.color}`}>{kat.label}</span>
                <span className="text-gray-400 font-normal">{items.length} Foto{items.length !== 1 ? 's' : ''}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {items.map(foto => (
                  <div key={foto.id} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer" onClick={() => setLightbox(foto)}>
                    <img src={foto.url} alt={foto.beschreibung ?? ''} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <ZoomIn className="w-5 h-5 text-white" />
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); loeschen(foto) }}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {foto.beschreibung && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1.5 py-1 truncate">
                        {foto.beschreibung}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {fotos.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Noch keine Fotos vorhanden</p>
          <p className="text-xs mt-1">Füge Fotos über "Kamera" oder "Galerie" hinzu</p>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <div className="relative max-w-4xl w-full mx-4" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.beschreibung ?? ''} className="w-full max-h-[80vh] object-contain rounded-lg" />
            {lightbox.beschreibung && (
              <p className="text-white text-center mt-3 text-sm">{lightbox.beschreibung}</p>
            )}
            <button onClick={() => setLightbox(null)} className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 rounded-full p-2 text-white">
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={() => loeschen(lightbox)}
              className="absolute bottom-4 right-4 bg-red-600 hover:bg-red-700 rounded-lg px-3 py-2 text-white text-sm flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />Löschen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
