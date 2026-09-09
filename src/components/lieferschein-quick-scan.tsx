'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  auftragId: string
  betriebId: string
  onSuccess?: () => void
}

export function LieferscheinQuickScan({ auftragId, betriebId, onSuccess }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dokumentTyp, setDokumentTyp] = useState<'lieferschein' | 'rechnung'>('lieferschein')

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Nur Bilder unterstützt')
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('auftragId', auftragId)
      formData.append('betriebId', betriebId)
      formData.append('dokumentTyp', dokumentTyp)

      const res = await fetch('/api/lieferschein/scan-and-insert', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setResult(data)
      onSuccess?.()
    } catch (err: any) {
      setError(err.message || 'Fehler beim Scannen')
    } finally {
      setIsLoading(false)
    }
  }

  if (result && result.erfolg) {
    return (
      <Card className="p-6 bg-green-50 border-green-200">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-bold text-green-900">
              ✅ {dokumentTyp === 'rechnung' ? 'Rechnung' : 'Lieferschein'} gescannt!
            </h3>
            <p className="text-sm text-green-800 mt-2">
              📦 <strong>{result.scannedTeile}</strong> Positionen erkannt
            </p>
            {dokumentTyp === 'lieferschein' ? (
              <p className="text-sm text-green-800">
                ✓ <strong>{result.gueltigeTeile}</strong> gültig, <strong>{result.eingefoegteTeile}</strong> eingefügt
              </p>
            ) : (
              <p className="text-sm text-green-800">Als Beleg archiviert, keine Ersatzteile angelegt.</p>
            )}
            <Button
              onClick={() => setResult(null)}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              Neuer Scan
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 border-blue-200 bg-blue-50">
      <div className="text-center">
        <div className="text-4xl mb-3">📄</div>
        <h3 className="font-bold mb-2">Dokument scannen</h3>
        <p className="text-sm text-gray-600 mb-4">
          {dokumentTyp === 'lieferschein' ? 'Teile werden automatisch erkannt & eingefügt' : 'Wird archiviert und in der Auftragsmappe angezeigt'}
        </p>

        <div className="flex gap-2 mb-4 justify-center">
          <button type="button" onClick={() => setDokumentTyp('lieferschein')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${dokumentTyp === 'lieferschein' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
            📦 Lieferschein
          </button>
          <button type="button" onClick={() => setDokumentTyp('rechnung')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${dokumentTyp === 'rechnung' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
            🧾 Rechnung
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded mb-4 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <label className="block">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileSelect(e.target.files[0])
              }
            }}
            disabled={isLoading}
            className="hidden"
          />
          <Button
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700"
            asChild
          >
            <span>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird gescannt...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  📸 Datei auswählen
                </>
              )}
            </span>
          </Button>
        </label>
      </div>
    </Card>
  )
}
