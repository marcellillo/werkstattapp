'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

interface ScannedPart {
  teilenummer?: string
  beschreibung: string
  menge: number
  lieferant?: string
  preis?: number
}

interface ScanResult {
  erfolg: boolean
  scannedTeile: number
  gebuchteTeile: number
  unmatchedTeile: ScannedPart[]
  details?: {
    lieferdatum?: string
    lieferant?: string
    bestellnummer?: string
    vermuteteArbeit?: string
    confidence: number
  }
}

interface LieferscheinScannerProps {
  betriebId: string
  kostenvoranschlag_id?: string
  auftragId?: string
  onSuccess?: (result: ScanResult) => void
}

export function LieferscheinScanner({ betriebId, kostenvoranschlag_id, auftragId, onSuccess }: LieferscheinScannerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewIsPdf, setPreviewIsPdf] = useState(false)
  const [previewName, setPreviewName] = useState<string | null>(null)
  const [dokumentTyp, setDokumentTyp] = useState<'lieferschein' | 'rechnung'>('lieferschein')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [arbeitUebernommen, setArbeitUebernommen] = useState(false)
  const [arbeitLaeuft, setArbeitLaeuft] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      await scanFile(files[0])
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      await scanFile(files[0])
    }
  }

  const scanFile = async (file: File) => {
    const isPdf = file.type === 'application/pdf'
    if (!file.type.startsWith('image/') && !isPdf) {
      setError('Nur Bilder oder PDF unterstützt (JPG, PNG, PDF, etc.)')
      return
    }

    setError(null)
    setIsLoading(true)

    // Preview anzeigen (PDFs lassen sich nicht als <img> darstellen, daher nur Dateiname)
    setPreviewIsPdf(isPdf)
    setPreviewName(file.name)
    if (isPdf) {
      setPreview(null)
    } else {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('betriebId', betriebId)
      formData.append('dokument_typ', dokumentTyp)
      if (kostenvoranschlag_id) formData.append('kostenvoranschlag_id', kostenvoranschlag_id)
      if (auftragId) formData.append('auftrag_id', auftragId)

      const res = await fetch('/api/lieferschein/scan', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Scan fehlgeschlagen')

      const scanResult: ScanResult = await res.json()
      setResult(scanResult)

      if (scanResult.erfolg) {
        // Wenn kostenvoranschlag_id vorhanden, Teile automatisch hinzufügen
        if (kostenvoranschlag_id && scanResult.unmatchedTeile.length > 0) {
          try {
            const addRes = await fetch('/api/kostenvoranschlag/add-teile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                kostenvoranschlag_id,
                betrieb_id: betriebId,
                teile: scanResult.unmatchedTeile,
              }),
            })
            if (addRes.ok) {
              console.log('✅ Teile erfolgreich eingefügt')
            } else {
              console.warn('⚠️ Teile konnten nicht eingefügt werden')
            }
          } catch (e) {
            console.warn('Fehler beim Hinzufügen:', e)
          }
        }
        onSuccess?.(scanResult)
      } else {
        setError('Lieferschein konnte nicht erkannt werden')
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Scannen')
    } finally {
      setIsLoading(false)
    }
  }

  const uebernehmeArbeit = async () => {
    const vorschlag = result?.details?.vermuteteArbeit
    if (!vorschlag || !auftragId) return
    setArbeitLaeuft(true)
    try {
      const supabase = createClient()
      const { data: auftrag } = await supabase
        .from('auftraege')
        .select('arbeiten')
        .eq('id', auftragId)
        .maybeSingle()

      const bisherige = (auftrag?.arbeiten || '').trim()
      const neuerText = bisherige ? `${bisherige}\n${vorschlag}` : vorschlag

      const { error } = await supabase
        .from('auftraege')
        .update({ arbeiten: neuerText })
        .eq('id', auftragId)

      if (error) throw error
      setArbeitUebernommen(true)
    } catch (e: any) {
      alert(`Fehler beim Übernehmen: ${e.message}`)
    } finally {
      setArbeitLaeuft(false)
    }
  }

  const resetScanner = () => {
    setPreview(null)
    setPreviewIsPdf(false)
    setPreviewName(null)
    setResult(null)
    setError(null)
  }

  if (result) {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-bold">Scan-Ergebnis</h3>

        {result.erfolg ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <p className="text-sm text-gray-600">Teile gescannt</p>
                <p className="text-2xl font-bold text-green-600">{result.scannedTeile}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <p className="text-sm text-gray-600">Automatisch eingebucht</p>
                <p className="text-2xl font-bold text-blue-600">{result.gebuchteTeile}</p>
              </div>
            </div>

            {result.details && (
              <div className="text-sm text-gray-600 space-y-1 bg-gray-50 p-3 rounded">
                {result.details.lieferant && <p>📦 Lieferant: {result.details.lieferant}</p>}
                {result.details.bestellnummer && <p>🏷️ Bestellnr: {result.details.bestellnummer}</p>}
                {result.details.lieferdatum && <p>📅 Lieferdatum: {result.details.lieferdatum}</p>}
                <p>✅ Erkennungssicherheit: {(result.details.confidence * 100).toFixed(0)}%</p>
              </div>
            )}

            {result.details?.vermuteteArbeit && (
              <div className="bg-purple-50 border border-purple-200 p-3 rounded space-y-2">
                <p className="text-sm font-semibold text-purple-900">🔧 Vermutete Arbeit (aus Teilen abgeleitet):</p>
                <p className="text-sm text-purple-800">{result.details.vermuteteArbeit}</p>
                {auftragId ? (
                  arbeitUebernommen ? (
                    <p className="text-sm text-green-700 font-medium">✅ In Arbeiten-Feld übernommen</p>
                  ) : (
                    <Button
                      onClick={uebernehmeArbeit}
                      disabled={arbeitLaeuft}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {arbeitLaeuft ? 'Wird übernommen...' : 'In Arbeiten übernehmen'}
                    </Button>
                  )
                ) : (
                  <p className="text-xs text-purple-600 italic">Bitte manuell ins Arbeiten-Feld übertragen.</p>
                )}
              </div>
            )}

            {result.unmatchedTeile.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-sm">⚠️ Nicht automatisch zugeordnet ({result.unmatchedTeile.length}):</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {result.unmatchedTeile.map((teil, idx) => (
                    <div key={idx} className="text-sm bg-yellow-50 p-2 rounded border border-yellow-200">
                      <p className="font-mono text-xs text-gray-600">
                        {teil.teilenummer ? `#${teil.teilenummer}` : 'Keine Nr.'}
                      </p>
                      <p>{teil.beschreibung}</p>
                      <p className="text-gray-600">Menge: {teil.menge}x</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={resetScanner} variant="outline" className="w-full">
              Neuer Scan
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-red-600 font-semibold">{error || 'Scan fehlgeschlagen'}</p>
            <Button onClick={resetScanner} variant="outline" className="w-full">
              Erneut versuchen
            </Button>
          </div>
        )}
      </Card>
    )
  }

  return (
    <Card className={`p-8 transition-all ${isDragging ? 'bg-blue-50 border-blue-400' : ''}`}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="space-y-4 text-center"
      >
        <div className="text-4xl">📸</div>
        <h3 className="text-lg font-bold">Lieferschein oder Rechnung einscannen</h3>
        <p className="text-gray-600">Ziehe ein Foto oder PDF hier rein oder klicke zum Hochladen</p>

        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={() => setDokumentTyp('lieferschein')}
            disabled={isLoading}
            className={`px-4 py-1.5 rounded text-sm font-medium transition ${
              dokumentTyp === 'lieferschein' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            📦 Lieferschein
          </button>
          <button
            type="button"
            onClick={() => setDokumentTyp('rechnung')}
            disabled={isLoading}
            className={`px-4 py-1.5 rounded text-sm font-medium transition ${
              dokumentTyp === 'rechnung' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            🧾 Rechnung
          </button>
        </div>

        {preview && (
          <div className="mt-4 rounded overflow-hidden border">
            <img src={preview} alt="Preview" className="max-h-48 mx-auto" />
          </div>
        )}
        {previewIsPdf && previewName && (
          <div className="mt-4 rounded border p-3 flex items-center gap-2 justify-center bg-slate-50">
            <span className="text-xl">📄</span>
            <span className="text-sm text-slate-700 truncate">{previewName}</span>
          </div>
        )}

        {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}

        <div className="flex gap-2">
          <label className="flex-1">
            <input type="file" accept="image/*,application/pdf" onChange={handleFileSelect} className="hidden" disabled={isLoading} />
            <Button
              asChild
              disabled={isLoading}
              className="w-full"
              variant={isDragging ? 'default' : 'outline'}
            >
              <span>{isLoading ? '⏳ Wird gescannt...' : '📁 Datei auswählen'}</span>
            </Button>
          </label>
        </div>
      </div>
    </Card>
  )
}
