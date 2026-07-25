'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBetrieb } from '@/lib/betrieb-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle, ExternalLink, Loader2, X } from 'lucide-react'

interface MaintenanceData {
  fahrzeugtyp?: string
  marke: string
  modell: string
  baujahr?: number
  motoroel_typ?: string
  motoroel_menge?: number
  klimagas_typ?: string
  klimagas_menge?: number
  oelwechsel_km?: number
  oelwechsel_monate?: number
}

interface Props {
  fahrzeugId: string
  fahrzeugName: string
  apiData?: MaintenanceData
  open: boolean
  onClose: () => void
  onSave: (data: MaintenanceData) => void
}

export function MaintenanceVerificationDialog({
  fahrzeugId,
  fahrzeugName,
  apiData,
  open,
  onClose,
  onSave,
}: Props) {
  const { currentBetriebId } = useBetrieb()
  const supabase = createClient()

  const [formData, setFormData] = useState<MaintenanceData>(
    apiData || {
      marke: '',
      modell: '',
    }
  )
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!open) return null

  const handleChange = (field: keyof MaintenanceData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value === '' ? undefined : value,
    }))
  }

  const handleSave = async () => {
    if (!currentBetriebId) return
    setLoading(true)

    try {
      const { error } = await supabase.from('maintenance_specs').insert({
        betrieb_id: currentBetriebId,
        fahrzeugtyp: formData.fahrzeugtyp,
        marke: formData.marke,
        modell: formData.modell,
        baujahr_von: formData.baujahr,
        motoroel_typ: formData.motoroel_typ,
        motoroel_menge: formData.motoroel_menge,
        klimagas_typ: formData.klimagas_typ,
        klimagas_menge: formData.klimagas_menge,
        oelwechsel_km: formData.oelwechsel_km,
        oelwechsel_monate: formData.oelwechsel_monate,
        quelle: apiData ? 'api' : 'manuell',
        verifiziert_am: new Date().toISOString().split('T')[0],
      })

      if (error) throw error

      setSaved(true)
      setTimeout(() => {
        onSave(formData)
        onClose()
      }, 1500)
    } catch (error) {
      alert(`Fehler beim Speichern: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Wartungs-Spezifikationen bestätigen</CardTitle>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Info */}
          <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">⚠️ Bitte überprüfen Sie die Daten</p>
              <p>
                {apiData
                  ? 'Diese Daten stammen von der API. Bitte vergleichen Sie mit dem Herstellerhandbuch!'
                  : 'Geben Sie die Wartungsdaten aus dem Herstellerhandbuch ein.'}
              </p>
            </div>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fahrzeugtyp */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fahrzeugtyp
              </label>
              <input
                type="text"
                placeholder="z.B. W205"
                value={formData.fahrzeugtyp || ''}
                onChange={(e) => handleChange('fahrzeugtyp', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Baujahr */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Baujahr
              </label>
              <input
                type="number"
                placeholder="z.B. 2020"
                value={formData.baujahr || ''}
                onChange={(e) => handleChange('baujahr', e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Motoröl-Typ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motoröl-Typ
              </label>
              <input
                type="text"
                placeholder="z.B. 5W-30"
                value={formData.motoroel_typ || ''}
                onChange={(e) => handleChange('motoroel_typ', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Motoröl-Menge */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motoröl-Menge (L)
              </label>
              <input
                type="number"
                placeholder="z.B. 5.5"
                step="0.1"
                value={formData.motoroel_menge || ''}
                onChange={(e) => handleChange('motoroel_menge', e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Klimagas-Typ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Klimagas-Typ
              </label>
              <input
                type="text"
                placeholder="z.B. R134a"
                value={formData.klimagas_typ || ''}
                onChange={(e) => handleChange('klimagas_typ', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Klimagas-Menge */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Klimagas-Menge (g)
              </label>
              <input
                type="number"
                placeholder="z.B. 600"
                value={formData.klimagas_menge || ''}
                onChange={(e) => handleChange('klimagas_menge', e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Ölwechsel KM */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ölwechsel Intervall (km)
              </label>
              <input
                type="number"
                placeholder="z.B. 15000"
                value={formData.oelwechsel_km || ''}
                onChange={(e) => handleChange('oelwechsel_km', e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Ölwechsel Monate */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ölwechsel Intervall (Monate)
              </label>
              <input
                type="number"
                placeholder="z.B. 12"
                value={formData.oelwechsel_monate || ''}
                onChange={(e) => handleChange('oelwechsel_monate', e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Info Box */}
          {apiData && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                💡 <strong>Tipp:</strong> Vergleichen Sie diese Werte mit dem Herstellerhandbuch oder
                der Serviceklappe unter der Motorhaube.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !formData.marke || !formData.modell}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Gespeichert!
                </>
              ) : loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                '✓ Bestätigen & Speichern'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
