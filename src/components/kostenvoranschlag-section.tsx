'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface Kostenvoranschlag {
  id: string
  nummer: string
  status: string
  created_at: string
  summe_brutto: number
}

interface KostenvoranschlagSectionProps {
  auftragId: string
  fahrzeugId: string
  betriebId: string
  kostenvoranschlaege?: Kostenvoranschlag[]
  kundenId?: string
  onKostenvoranschlagCreated?: () => void
}

export function KostenvoranschlagSection({
  auftragId,
  fahrzeugId,
  betriebId,
  kostenvoranschlaege = [],
  kundenId,
  onKostenvoranschlagCreated,
}: KostenvoranschlagSectionProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateKostenvoranschlag = async () => {
    if (!kundenId) {
      setError('Kunden-ID erforderlich')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/kostenvoranschlag/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auftrag_id: auftragId,
          fahrzeug_id: fahrzeugId,
          kunde_id: kundenId,
          betrieb_id: betriebId,
          status: 'entwurf',
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Kostenvoranschlag konnte nicht erstellt werden')
      }

      setIsCreating(false)
      onKostenvoranschlagCreated?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const exportPDF = async (kostenvoranschlagId: string) => {
    try {
      const res = await fetch('/api/kostenvoranschlag/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kostenvoranschlagId, betriebId }),
      })

      if (!res.ok) throw new Error('PDF-Export fehlgeschlagen')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Kostenvoranschlag_${kostenvoranschlagId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Fehler: ${err.message}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Kostenvoranschläge</h3>
        <Button onClick={() => setIsCreating(!isCreating)} size="sm">
          {isCreating ? '✕' : '+ Neuer KV'}
        </Button>
      </div>

      {isCreating && (
        <Card className="p-4 space-y-4 bg-purple-50 border-purple-200">
          <p className="text-sm text-gray-600">
            Ein neuer Kostenvoranschlag wird erstellt. Danach kannst du Positionen hinzufügen.
          </p>

          {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleCreateKostenvoranschlag} disabled={isLoading} className="flex-1">
              {isLoading ? '⏳ Erstelle...' : '✓ Erstellen'}
            </Button>
            <Button onClick={() => setIsCreating(false)} variant="outline" className="flex-1">
              ✕ Abbrechen
            </Button>
          </div>
        </Card>
      )}

      {kostenvoranschlaege.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">Keine Kostenvoranschläge vorhanden</p>
      ) : (
        <div className="space-y-2">
          {kostenvoranschlaege.map(kv => (
            <Card key={kv.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{kv.nummer}</p>
                  <p className="text-sm text-gray-600">{kv.status}</p>
                  <p className="text-sm text-gray-500">{new Date(kv.created_at).toLocaleDateString('de-DE')}</p>
                </div>
                <div className="text-right space-y-2">
                  <p className="font-bold">{kv.summe_brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => exportPDF(kv.id)}>
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
