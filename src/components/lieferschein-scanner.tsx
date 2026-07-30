'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

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
    confidence: number
  }
}

interface LieferscheinScannerProps {
  betriebId: string
  onSuccess?: (result: ScanResult) => void
}

export function LieferscheinScanner({ betriebId, onSuccess }: LieferscheinScannerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    if (!file.type.startsWith('image/')) {
      setError('Nur Bilder unterstützt (JPG, PNG, etc.)')
      return
    }

    setError(null)
    setIsLoading(true)

    // Preview anzeigen
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('betriebId', betriebId)

      const res = await fetch('/api/lieferschein/scan', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Scan fehlgeschlagen')

      const scanResult: ScanResult = await res.json()
      setResult(scanResult)

      if (scanResult.erfolg) {
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

  const resetScanner = () => {
    setPreview(null)
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
        <h3 className="text-lg font-bold">Lieferschein einscannen</h3>
        <p className="text-gray-600">Ziehe ein Foto des Lieferscheins hier rein oder klicke zum Hochladen</p>

        {preview && (
          <div className="mt-4 rounded overflow-hidden border">
            <img src={preview} alt="Preview" className="max-h-48 mx-auto" />
          </div>
        )}

        {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}

        <div className="flex gap-2">
          <label className="flex-1">
            <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" disabled={isLoading} />
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
