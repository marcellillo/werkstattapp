'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Rechnung {
  id: string
  nummer: string
  typ: 'werkstatt' | 'verkauf'
  status: string
  created_at: string
  summe_brutto: number
}

interface RechnungSectionProps {
  auftragId: string
  fahrzeugId: string
  betriebId: string
  rechnungen?: Rechnung[]
  kundenId?: string
  onRechnungCreated?: () => void
}

export function RechnungSection({
  auftragId,
  fahrzeugId,
  betriebId,
  rechnungen = [],
  kundenId,
  onRechnungCreated,
}: RechnungSectionProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [selectedType, setSelectedType] = useState<'werkstatt' | 'verkauf'>('werkstatt')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateRechnung = async () => {
    if (!kundenId) {
      setError('Kunden-ID erforderlich')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/rechnung/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auftrag_id: auftragId,
          fahrzeug_id: fahrzeugId,
          kunde_id: kundenId,
          betrieb_id: betriebId,
          typ: selectedType,
          status: 'entwurf',
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Rechnung konnte nicht erstellt werden')
      }

      onRechnungCreated?.()
      setIsCreating(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const exportPDF = async (rechnungId: string) => {
    try {
      const res = await fetch('/api/rechnung/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rechnungId, betriebId }),
      })

      if (!res.ok) throw new Error('PDF-Export fehlgeschlagen')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Rechnung_${rechnungId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Fehler: ${err.message}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Rechnungen</h3>
        <Button onClick={() => setIsCreating(!isCreating)} size="sm">
          {isCreating ? '✕' : '+ Neue Rechnung'}
        </Button>
      </div>

      {isCreating && (
        <Card className="p-4 space-y-4 bg-blue-50 border-blue-200">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Rechnungstyp</label>
            <Select value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="werkstatt">Werkstatt-Rechnung</SelectItem>
                <SelectItem value="verkauf">Verkaufs-Rechnung</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleCreateRechnung} disabled={isLoading} className="flex-1">
              {isLoading ? '⏳ Erstelle...' : '✓ Erstellen'}
            </Button>
            <Button onClick={() => setIsCreating(false)} variant="outline" className="flex-1">
              ✕ Abbrechen
            </Button>
          </div>
        </Card>
      )}

      {rechnungen.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">Keine Rechnungen vorhanden</p>
      ) : (
        <div className="space-y-2">
          {rechnungen.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{r.nummer}</p>
                  <p className="text-sm text-gray-600">
                    {r.typ === 'werkstatt' ? '🔧 Werkstatt' : '🚗 Verkauf'} • {r.status}
                  </p>
                  <p className="text-sm text-gray-500">{new Date(r.created_at).toLocaleDateString('de-DE')}</p>
                </div>
                <div className="text-right space-y-2">
                  <p className="font-bold">{r.summe_brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => exportPDF(r.id)}>
                      💾 PDF
                    </Button>
                    <Button size="sm" variant="outline">
                      ✉️ Email
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
