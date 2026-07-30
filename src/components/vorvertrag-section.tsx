'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface Vorvertrag {
  id: string
  nummer: string
  status: string
  kaufpreis: number
  anzahlung?: number
  kaeufer_name: string
  created_at: string
}

interface VorvertragSectionProps {
  fahrzeugId: string
  betriebId: string
  vorvertraege?: Vorvertrag[]
  onVorvertragCreated?: () => void
}

export function VorvertragSection({
  fahrzeugId,
  betriebId,
  vorvertraege = [],
  onVorvertragCreated,
}: VorvertragSectionProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    kaeuferName: '',
    kaeuferStrasse: '',
    kaeuferPlz: '',
    kaeuferOrt: '',
    kaeuferTelefon: '',
    kaufpreis: '',
    anzahlung: '',
  })

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleCreateVorvertrag = async () => {
    if (!formData.kaeuferName || !formData.kaufpreis) {
      setError('Käufername und Kaufpreis erforderlich')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/vorvertrag/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fahrzeug_id: fahrzeugId,
          betrieb_id: betriebId,
          status: 'entwurf',
          kaeufer_name: formData.kaeuferName,
          kaeufer_strasse: formData.kaeuferStrasse,
          kaeufer_plz: formData.kaeuferPlz,
          kaeufer_ort: formData.kaeuferOrt,
          kaeufer_telefon: formData.kaeuferTelefon,
          kaufpreis: parseFloat(formData.kaufpreis),
          anzahlung: formData.anzahlung ? parseFloat(formData.anzahlung) : null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Vorvertrag konnte nicht erstellt werden')
      }

      setFormData({
        kaeuferName: '',
        kaeuferStrasse: '',
        kaeuferPlz: '',
        kaeuferOrt: '',
        kaeuferTelefon: '',
        kaufpreis: '',
        anzahlung: '',
      })
      setIsCreating(false)
      onVorvertragCreated?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const exportPDF = async (vorvertragId: string) => {
    try {
      const res = await fetch('/api/vorvertrag/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vorvertragId, betriebId }),
      })

      if (!res.ok) throw new Error('PDF-Export fehlgeschlagen')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Vorvertrag_${vorvertragId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Fehler: ${err.message}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Vorverträge (Verkauf)</h3>
        <Button onClick={() => setIsCreating(!isCreating)} size="sm">
          {isCreating ? '✕' : '+ Neuer Vorvertrag'}
        </Button>
      </div>

      {isCreating && (
        <Card className="p-4 space-y-3 bg-green-50 border-green-200">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Käufername"
              value={formData.kaeuferName}
              onChange={e => handleChange('kaeuferName', e.target.value)}
              className="px-2 py-1 text-sm border rounded"
            />
            <input
              type="text"
              placeholder="Straße"
              value={formData.kaeuferStrasse}
              onChange={e => handleChange('kaeuferStrasse', e.target.value)}
              className="px-2 py-1 text-sm border rounded"
            />
            <input
              type="text"
              placeholder="PLZ"
              value={formData.kaeuferPlz}
              onChange={e => handleChange('kaeuferPlz', e.target.value)}
              className="px-2 py-1 text-sm border rounded"
            />
            <input
              type="text"
              placeholder="Ort"
              value={formData.kaeuferOrt}
              onChange={e => handleChange('kaeuferOrt', e.target.value)}
              className="px-2 py-1 text-sm border rounded"
            />
            <input
              type="tel"
              placeholder="Telefon (optional)"
              value={formData.kaeuferTelefon}
              onChange={e => handleChange('kaeuferTelefon', e.target.value)}
              className="px-2 py-1 text-sm border rounded"
            />
            <input
              type="number"
              placeholder="Kaufpreis (€)"
              value={formData.kaufpreis}
              onChange={e => handleChange('kaufpreis', e.target.value)}
              className="px-2 py-1 text-sm border rounded"
            />
            <input
              type="number"
              placeholder="Anzahlung (€) (optional)"
              value={formData.anzahlung}
              onChange={e => handleChange('anzahlung', e.target.value)}
              className="px-2 py-1 text-sm border rounded col-span-2"
            />
          </div>

          {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleCreateVorvertrag} disabled={isLoading} className="flex-1">
              {isLoading ? '⏳ Erstelle...' : '✓ Erstellen'}
            </Button>
            <Button onClick={() => setIsCreating(false)} variant="outline" className="flex-1">
              ✕ Abbrechen
            </Button>
          </div>
        </Card>
      )}

      {vorvertraege.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">Keine Vorverträge vorhanden</p>
      ) : (
        <div className="space-y-2">
          {vorvertraege.map(v => (
            <Card key={v.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{v.nummer}</p>
                  <p className="text-sm text-gray-600">Käufer: {v.kaeufer_name}</p>
                  <p className="text-sm text-gray-500">{new Date(v.created_at).toLocaleDateString('de-DE')}</p>
                </div>
                <div className="text-right space-y-2">
                  <p className="font-bold">{v.kaufpreis.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                  {v.anzahlung && (
                    <p className="text-sm text-gray-600">
                      Anzahlung: {v.anzahlung.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </p>
                  )}
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => exportPDF(v.id)}>
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
