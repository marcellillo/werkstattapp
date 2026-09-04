'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trash2, FileWarning, CheckCircle2 } from 'lucide-react'

interface LieferscheinUpload {
  id: string
  datei_url: string
  dateiname: string | null
  lieferant: string | null
  bestellnummer: string | null
  lieferdatum: string | null
  teile_anzahl: number
  erfolg: boolean
  fehlermeldung: string | null
  erstellt_am: string
}

interface Props {
  kostenvoranschlagId?: string
  refreshSignal?: number
}

export function LieferscheinGalerie({ kostenvoranschlagId, refreshSignal }: Props) {
  const [uploads, setUploads] = useState<LieferscheinUpload[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!kostenvoranschlagId) return
    loadUploads()
  }, [kostenvoranschlagId, refreshSignal])

  const loadUploads = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('lieferschein_uploads')
        .select('*')
        .eq('kostenvoranschlag_id', kostenvoranschlagId)
        .order('erstellt_am', { ascending: false })

      if (error) throw error
      setUploads(data || [])
    } catch (error) {
      console.error('[LieferscheinGalerie] Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Diesen hochgeladenen Lieferschein aus der Übersicht entfernen?')) return
    try {
      const supabase = createClient()
      await supabase.from('lieferschein_uploads').delete().eq('id', id)
      setUploads(prev => prev.filter(u => u.id !== id))
    } catch (error) {
      console.error('[LieferscheinGalerie] Fehler beim Löschen:', error)
    }
  }

  if (!kostenvoranschlagId) return null
  if (!loading && uploads.length === 0) return null

  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-slate-700 mb-2">
        📎 Bereits hochgeladene Lieferscheine {uploads.length > 0 && `(${uploads.length})`}
      </p>
      {loading ? (
        <p className="text-sm text-slate-500">Wird geladen...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {uploads.map(u => (
            <div
              key={u.id}
              role="link"
              tabIndex={0}
              onClick={() => window.open(u.datei_url, '_blank', 'noopener,noreferrer')}
              onKeyDown={e => { if (e.key === 'Enter') window.open(u.datei_url, '_blank', 'noopener,noreferrer') }}
              className={`relative group block rounded-lg border overflow-hidden cursor-pointer ${
                u.erfolg ? 'border-slate-200' : 'border-red-300 bg-red-50'
              }`}
              title={u.fehlermeldung || undefined}
            >
              <img src={u.datei_url} alt={u.dateiname || 'Lieferschein'} className="w-full h-24 object-cover bg-slate-100" />
              <div className="p-1.5 text-xs">
                <p className="font-medium truncate flex items-center gap-1">
                  {u.erfolg ? (
                    <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                  ) : (
                    <FileWarning className="w-3 h-3 text-red-600 flex-shrink-0" />
                  )}
                  {u.lieferant || u.dateiname || 'Lieferschein'}
                </p>
                <p className="text-slate-500 truncate">
                  {u.erfolg ? `${u.teile_anzahl} Teile` : 'Nicht erkannt'} · {new Date(u.erstellt_am).toLocaleDateString('de-DE')}
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(u.id) }}
                className="absolute top-1 right-1 p-1 bg-white/90 rounded hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Aus Übersicht entfernen"
              >
                <Trash2 className="w-3 h-3 text-red-600" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
