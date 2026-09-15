'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { X, Upload, Loader2 } from 'lucide-react'

interface VehicleEditDialogProps {
  fahrzeug: any
  open: boolean
  onClose: () => void
  onSave: () => void
}

export function VehicleEditDialog({ fahrzeug, open, onClose, onSave }: VehicleEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    marke: fahrzeug?.marke || '',
    modell: fahrzeug?.modell || '',
    baujahr: fahrzeug?.baujahr || '',
    kennzeichen: fahrzeug?.kennzeichen || '',
    b_nummer: fahrzeug?.b_nummer || '',
    farbe: fahrzeug?.farbe || '',
    kilometerstand: fahrzeug?.kilometerstand || '',
    einkaufspreis: fahrzeug?.einkaufspreis || '',
    verkaufspreis: fahrzeug?.verkaufspreis || '',
    notizen: fahrzeug?.notizen || '',
  })

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!fahrzeug?.id) return
    setLoading(true)

    const sb = createClient()
    const updates: Record<string, any> = {}

    // Nur geänderte Felder updaten
    Object.keys(formData).forEach(key => {
      const oldVal = fahrzeug[key]
      const newVal = formData[key as keyof typeof formData]
      if (oldVal !== newVal && newVal !== '') {
        updates[key] = newVal === '' ? null : newVal
      }
    })

    const { error } = await sb
      .from('fahrzeuge')
      .update(updates)
      .eq('id', fahrzeug.id)

    setLoading(false)

    if (error) {
      alert(`Fehler beim Speichern: ${error.message}`)
      return
    }

    onSave()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {fahrzeug?.marke} {fahrzeug?.modell} bearbeiten
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Marke */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Marke
              </label>
              <input
                type="text"
                value={formData.marke}
                onChange={(e) => handleChange('marke', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Modell */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Modell
              </label>
              <input
                type="text"
                value={formData.modell}
                onChange={(e) => handleChange('modell', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Baujahr */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Baujahr
              </label>
              <input
                type="text"
                placeholder="z.B. 2020"
                value={formData.baujahr}
                onChange={(e) => handleChange('baujahr', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Kennzeichen */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Kennzeichen
              </label>
              <input
                type="text"
                placeholder="z.B. HH-AB-123"
                value={formData.kennzeichen}
                onChange={(e) => handleChange('kennzeichen', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* B-Nummer */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                B-Nummer
              </label>
              <input
                type="text"
                placeholder="z.B. 70001"
                value={formData.b_nummer}
                onChange={(e) => handleChange('b_nummer', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Farbe */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Farbe
              </label>
              <input
                type="text"
                placeholder="z.B. Schwarz"
                value={formData.farbe}
                onChange={(e) => handleChange('farbe', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Kilometerstand */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Kilometerstand
              </label>
              <input
                type="text"
                placeholder="z.B. 125000"
                value={formData.kilometerstand}
                onChange={(e) => handleChange('kilometerstand', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Einkaufspreis */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Einkaufspreis (€)
              </label>
              <input
                type="text"
                placeholder="z.B. 15000"
                value={formData.einkaufspreis}
                onChange={(e) => handleChange('einkaufspreis', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Verkaufspreis */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Verkaufspreis (€)
              </label>
              <input
                type="text"
                placeholder="z.B. 18000"
                value={formData.verkaufspreis}
                onChange={(e) => handleChange('verkaufspreis', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notizen */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notizen
            </label>
            <textarea
              value={formData.notizen}
              onChange={(e) => handleChange('notizen', e.target.value)}
              placeholder="z.B. Zustand, besondere Merkmale..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                'Speichern'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
