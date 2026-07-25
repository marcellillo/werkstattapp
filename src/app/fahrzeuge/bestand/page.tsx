'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react'

export default function BestandPage() {
  const [uploading, setUploading] = useState(false)
  const [importingImages, setImportingImages] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [stats, setStats] = useState<{
    importiert: number
    aktualisiert: number
    uebersprungen: number
  } | null>(null)
  const [imageStats, setImageStats] = useState<{
    updated: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImportImages() {
    setImportingImages(true)
    setError('')

    try {
      console.log('[Bestand] Starting image import...')
      const response = await fetch('/api/mobile-import-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      console.log('[Bestand] Response status:', response.status)
      const result = await response.json()
      console.log('[Bestand] Response data:', result)

      if (!response.ok) {
        const errorMsg = result.error || result.message || 'Bild-Import fehlgeschlagen'
        throw new Error(errorMsg)
      }

      setImageStats({ updated: result.updated || 0 })
      setSuccess(`✅ Import abgeschlossen! ${stats?.importiert || 0} Fahrzeuge + ${result.updated || 0} mit Bildern`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Bild-Import fehlgeschlagen'
      console.error('[Bestand] Error:', errorMsg)
      setError(errorMsg)
    } finally {
      setImportingImages(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    setSuccess('')
    setStats(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())

      if (lines.length < 2) {
        throw new Error('CSV-Datei ist leer oder hat nur Header')
      }

      // CSV Parser für quoted fields (z.B. "field","value")
      const parseCSVLine = (line: string) => {
        const values = []
        let current = ''
        let inQuotes = false

        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^"|"$/g, ''))
            current = ''
          } else {
            current += char
          }
        }
        values.push(current.trim().replace(/^"|"$/g, ''))
        return values
      }

      // CSV parsen (Header aus Zeile 1)
      const headerValues = parseCSVLine(lines[0])
      const headers = headerValues.map(h => h.toLowerCase())
      console.log('[CSV Parse] Headers:', headers.length, 'columns')
      console.log('[CSV Parse] Total lines:', lines.length)

      const ads = lines.slice(1).map((line, idx) => {
        try {
          const values = parseCSVLine(line)
          if (values.length !== headers.length) {
            console.warn(`[CSV Parse] Line ${idx + 2}: Expected ${headers.length} columns, got ${values.length}`)
          }
          const ad: any = {}
          headers.forEach((header, i) => {
            ad[header] = values[i] || null
          })
          return ad
        } catch (e) {
          console.error(`[CSV Parse] Error parsing line ${idx + 2}:`, e)
          return null
        }
      }).filter(Boolean)

      // Import-API aufrufen
      const response = await fetch('/api/mobile-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ads }),
      })

      console.log('[Bestand] Upload response status:', response.status)
      const responseText = await response.text()
      console.log('[Bestand] Response body:', responseText.substring(0, 500))

      let result
      try {
        result = JSON.parse(responseText)
      } catch (e) {
        console.error('[Bestand] JSON parse error:', e)
        throw new Error(`Server-Fehler (${response.status}): ${responseText.substring(0, 200)}`)
      }

      if (!response.ok) {
        throw new Error(result.error || `Import fehlgeschlagen (${response.status})`)
      }

      setStats({
        importiert: result.importiert || 0,
        aktualisiert: result.aktualisiert || 0,
        uebersprungen: result.uebersprungen || 0,
      })

      setSuccess(`✅ Import erfolgreich! ${result.importiert} neue, ${result.aktualisiert} aktualisiert`)

      // Auto-import Bilder nach erfolgreichem CSV-Import (neu ODER aktualisiert)
      if (result.importiert > 0 || result.aktualisiert > 0) {
        setTimeout(() => {
          handleImportImages()
        }, 500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Eigenbestand</h1>
        <p className="text-slate-600 mt-1">Mobile.de CSV hochladen → Automatischer Import</p>
      </div>

      {/* Upload Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Mobile.de CSV Upload</h2>
            <p className="text-sm text-slate-600">Lade deine Mobile.de Bestandsdatei hoch</p>
          </div>
        </div>

        {/* Upload Area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition"
        >
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-900">CSV-Datei auswählen</p>
          <p className="text-sm text-slate-600">oder hier ziehen</p>
          <p className="text-xs text-slate-500 mt-2">
            Spalten: internalNumber, marke, modell, vin, baujahr, farbe, kraftstoff, etc.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
        />

        {/* Status Messages */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">{error}</p>
            </div>
          </div>
        )}

        {(success || importingImages) && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            {importingImages ? (
              <Loader2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-semibold text-green-900">
                {importingImages ? '⏳ Bilder werden importiert...' : success}
              </p>
              {stats && (
                <div className="mt-2 text-sm text-green-800 space-y-1">
                  <p>📥 Fahrzeuge importiert: <strong>{stats.importiert}</strong></p>
                  <p>🔄 Aktualisiert: <strong>{stats.aktualisiert}</strong></p>
                  <p>⏭️ Übersprungen: <strong>{stats.uebersprungen}</strong></p>
                </div>
              )}
              {imageStats && (
                <div className="mt-2 text-sm text-green-800">
                  <p>🖼️ Bilder übernommen: <strong>{imageStats.updated}</strong> Fahrzeuge</p>
                </div>
              )}
              {stats && stats.importiert > 0 && !importingImages && !imageStats && (
                <button
                  onClick={handleImportImages}
                  disabled={importingImages}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  🖼️ Fahrzeug-Bilder importieren
                </button>
              )}
            </div>
          </div>
        )}

        {uploading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-blue-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Datei wird importiert...</span>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">💡 So funktioniert's:</h3>
        <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
          <li>Exporte deine Fahrzeuge aus Mobile.de als CSV</li>
          <li>Lade die CSV-Datei hier hoch</li>
          <li>Neue Fahrzeuge werden automatisch importiert</li>
          <li>Bestehende Fahrzeuge werden aktualisiert</li>
          <li>Status-Updates laufen automatisch (später)</li>
        </ol>
      </div>

      {/* CSV Format Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
        <h3 className="font-semibold text-slate-900 mb-3">📋 CSV-Format:</h3>
        <p className="text-sm text-slate-600 mb-3">Deine CSV sollte diese Spalten haben:</p>
        <code className="text-xs bg-slate-800 text-slate-100 p-3 rounded block overflow-x-auto">
          internalNumber, marke, modell, vin, baujahr, farbe, kraftstoff, km, preis
        </code>
        <p className="text-xs text-slate-500 mt-3">
          ℹ️ internalNumber = B-Nummer von Mobile.de (Eindeutiges ID-Feld)
        </p>
      </div>
    </div>
  )
}
