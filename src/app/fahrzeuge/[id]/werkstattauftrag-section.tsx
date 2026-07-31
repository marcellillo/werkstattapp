'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Clock, CheckCircle, Printer } from 'lucide-react'

interface Props {
  auftragId: string
  betriebId: string
  fahrzeugId: string
}

export function WerkstattauftragSection({ auftragId, betriebId, fahrzeugId }: Props) {
  const [auftraege, setAuftraege] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/werkstattauftrag/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auftragId, betriebId, fahrzeugId }),
      })
      const data = await response.json()
      if (data.werkstattauftrag) {
        setAuftraege([...auftraege, data.werkstattauftrag])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (auftragId: string, newStatus: string) => {
    const response = await fetch(`/api/werkstattauftrag/${auftragId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    const data = await response.json()
    if (data.werkstattauftrag) {
      setAuftraege(auftraege.map(a => a.id === auftragId ? data.werkstattauftrag : a))
    }
  }

  const handleExportPDF = async (auftragId: string) => {
    try {
      const response = await fetch('/api/werkstattauftrag/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auftragId, betriebId }),
      })
      if (!response.ok) throw new Error('PDF-Export fehlgeschlagen')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Werkstattauftrag_${auftragId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('PDF-Export Fehler:', error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>🔧 Werkstattauftrag</CardTitle>
          <Button onClick={handleCreate} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Erstellen
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {auftraege.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Kein Werkstattauftrag vorhanden</p>
        ) : (
          <div className="space-y-3">
            {auftraege.map(auftrag => (
              <div key={auftrag.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">{auftrag.beschreibung || 'Werkstattauftrag'}</p>
                  <p className="text-sm text-slate-600">Status: {auftrag.status}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => handleExportPDF(auftrag.id)} title="PDF drucken">
                    <Printer className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleStatusChange(auftrag.id, 'in_bearbeitung')}>
                    <Clock className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleStatusChange(auftrag.id, 'fertig')}>
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
