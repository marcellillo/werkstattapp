'use client'
import { useState } from 'react'
import { X, Loader2, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { berechneFahrzeugSteuer, STEUERART_LABEL, STEUERART_COLOR, type Steuerart } from '@/lib/fahrzeug-steuer'

interface VerkaufenModalProps {
  auftragId: string
  fahrzeugId: string | null
  marke: string
  modell: string
  einkaufspreis: number | null
  standardSteuerart: Steuerart
  onClose: () => void
  onSuccess: () => void
}

const fmtEuro = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export function VerkaufenModal({
  auftragId,
  fahrzeugId,
  marke,
  modell,
  einkaufspreis,
  standardSteuerart,
  onClose,
  onSuccess,
}: VerkaufenModalProps) {
  const supabase = createClient()
  const [kaeufer, setKaeufer] = useState('')
  const [verkaufspreis, setVerkaufspreis] = useState('')
  const [steuerart, setSteuerart] = useState<Steuerart>(standardSteuerart)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Nur für Live-Vorschau
  const vkNum = verkaufspreis.trim() ? parseFloat(verkaufspreis.replace(',', '.')) : 0
  const ekNum = einkaufspreis ?? 0
  const steuerInfo = berechneFahrzeugSteuer({
    verkaufspreis: vkNum,
    einkaufspreis: ekNum,
    steuerart,
  })

  const isValid = kaeufer.trim().length > 0 && vkNum > 0

  async function handleVerkaufen() {
    if (!isValid) {
      setError('Bitte Käufer und Verkaufspreis eingeben')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Status + Verkauf-Daten speichern
      const { error: updateError } = await supabase
        .from('auftraege')
        .update({
          status: 'verkauft',
          einnahmen: vkNum,
          kaeufer_name: kaeufer.trim(),
          steuerart,
          verkauft_am: new Date().toISOString().split('T')[0],
        })
        .eq('id', auftragId)

      if (updateError) throw updateError

      // Fahrzeug-EK speichern (falls geändert)
      if (fahrzeugId && ekNum > 0) {
        const { error: fahrzeugError } = await supabase
          .from('fahrzeuge')
          .update({ einkaufspreis: ekNum })
          .eq('id', fahrzeugId)

        if (fahrzeugError) throw fahrzeugError
      }

      onSuccess()
    } catch (err) {
      console.error('Fehler beim Verkaufen:', err)
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Fahrzeug verkaufen</h2>
            <p className="text-sm text-gray-500 mt-1">
              {marke} {modell}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Inputs */}
        <div className="space-y-4 mb-6">
          {/* Käufer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Käufername <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={kaeufer}
              onChange={(e) => setKaeufer(e.target.value)}
              placeholder="z.B. Max Mustermann"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>

          {/* Verkaufspreis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Verkaufspreis <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center">
              <input
                type="text"
                value={verkaufspreis}
                onChange={(e) => setVerkaufspreis(e.target.value)}
                placeholder="15000,00"
                disabled={loading}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
              />
              <span className="ml-2 text-gray-500 font-medium">€</span>
            </div>
          </div>

          {/* Steuerart */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Steuerart
            </label>
            <select
              value={steuerart}
              onChange={(e) => setSteuerart(e.target.value as Steuerart)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="differenz">Differenzbesteuerung §25a</option>
              <option value="regel">Regelbesteuerung 19%</option>
              <option value="ausfuhr">Ausfuhr (steuerfrei)</option>
            </select>
          </div>
        </div>

        {/* Steuern-Vorschau */}
        {vkNum > 0 && (
          <div className={`mb-6 p-4 rounded-xl border-2 ${STEUERART_COLOR[steuerart]}`}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4" />
              <h3 className="font-semibold text-sm">Steuerberechnung ({STEUERART_LABEL[steuerart]})</h3>
            </div>

            <div className="space-y-2 text-sm">
              {ekNum > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Einkaufspreis:</span>
                  <span className="font-medium">{fmtEuro(ekNum)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600">Verkaufspreis (brutto):</span>
                <span className="font-medium">{fmtEuro(vkNum)}</span>
              </div>

              <div className="h-px bg-current opacity-20 my-2" />

              <div className="flex justify-between font-semibold">
                <span>Marge:</span>
                <span>{fmtEuro(steuerInfo.marge)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">MwSt (abzuführen):</span>
                <span className="text-amber-700">{fmtEuro(steuerInfo.mwst)}</span>
              </div>

              {ekNum > 0 && (
                <div className="flex justify-between font-semibold text-green-700">
                  <span>Gewinn (netto):</span>
                  <span>{fmtEuro(steuerInfo.gewinn)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleVerkaufen}
            disabled={!isValid || loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Wird gespeichert...' : 'Als verkauft markieren'}
          </button>
        </div>
      </div>
    </>
  )
}
