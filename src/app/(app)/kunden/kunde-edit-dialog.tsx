'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { X, Loader2 } from 'lucide-react'
import type { Kunde } from '@/types/database'

interface KundeEditDialogProps {
  kunde: Kunde | null
  open: boolean
  onClose: () => void
  onSave: (updated: Kunde) => void
}

type KundeFormFeld = 'vorname' | 'nachname' | 'firma' | 'email' | 'telefon' | 'mobil' | 'strasse' | 'plz' | 'ort'

const FELDER: { key: KundeFormFeld; label: string; span2?: boolean }[] = [
  { key: 'vorname', label: 'Vorname' },
  { key: 'nachname', label: 'Nachname *' },
  { key: 'firma', label: 'Firma', span2: true },
  { key: 'email', label: 'E-Mail', span2: true },
  { key: 'telefon', label: 'Telefon' },
  { key: 'mobil', label: 'Mobil' },
  { key: 'strasse', label: 'Straße', span2: true },
  { key: 'plz', label: 'PLZ' },
  { key: 'ort', label: 'Ort' },
]

export function KundeEditDialog({ kunde, open, onClose, onSave }: KundeEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    vorname: kunde?.vorname || '',
    nachname: kunde?.nachname || '',
    firma: kunde?.firma || '',
    email: kunde?.email || '',
    telefon: kunde?.telefon || '',
    mobil: kunde?.mobil || '',
    strasse: kunde?.strasse || '',
    plz: kunde?.plz || '',
    ort: kunde?.ort || '',
    notizen: kunde?.notizen || '',
  })

  // Formular neu befüllen, wenn ein anderer Kunde zum Bearbeiten geöffnet wird
  const [lastKundeId, setLastKundeId] = useState(kunde?.id)
  if (kunde && kunde.id !== lastKundeId) {
    setLastKundeId(kunde.id)
    setFormData({
      vorname: kunde.vorname || '',
      nachname: kunde.nachname || '',
      firma: kunde.firma || '',
      email: kunde.email || '',
      telefon: kunde.telefon || '',
      mobil: kunde.mobil || '',
      strasse: kunde.strasse || '',
      plz: kunde.plz || '',
      ort: kunde.ort || '',
      notizen: kunde.notizen || '',
    })
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!kunde?.id) return
    if (!formData.nachname.trim()) { setError('Nachname ist erforderlich'); return }
    setError('')
    setLoading(true)

    const sb = createClient()
    const updates = {
      vorname: formData.vorname || null,
      nachname: formData.nachname,
      firma: formData.firma || null,
      email: formData.email || null,
      telefon: formData.telefon || null,
      mobil: formData.mobil || null,
      strasse: formData.strasse || null,
      plz: formData.plz || null,
      ort: formData.ort || null,
      notizen: formData.notizen || null,
    }

    const { data, error: updateError } = await sb
      .from('kunden')
      .update(updates)
      .eq('id', kunde.id)
      .select()
      .single()

    setLoading(false)

    if (updateError) {
      setError(`Fehler beim Speichern: ${updateError.message}`)
      return
    }

    onSave(data as Kunde)
    onClose()
  }

  if (!open || !kunde) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {kunde.vorname} {kunde.nachname} bearbeiten
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {FELDER.map(({ key, label, span2 }) => (
              <div key={key} className={span2 ? 'md:col-span-2' : ''}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                <input
                  type="text"
                  value={formData[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Notizen</label>
            <textarea
              value={formData.notizen}
              onChange={(e) => handleChange('notizen', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</div>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Speichern...</>) : 'Speichern'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
