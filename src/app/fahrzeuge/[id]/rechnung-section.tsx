'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Printer, Mail, Edit2 } from 'lucide-react'

interface Props {
  auftragId: string
  betriebId: string
  fahrzeugId?: string
}

export function RechnungSection({ auftragId, betriebId, fahrzeugId }: Props) {
  const [rechnungen, setRechnungen] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTyp, setSelectedTyp] = useState<'werkstatt' | 'verkauf'>('werkstatt')

  const handleCreate = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/rechnung/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auftragId, betriebId, fahrzeugId, typ: selectedTyp }),
      })
      const data = await response.json()
      if (data.rechnung) {
        setRechnungen([...rechnungen, data.rechnung])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>📄 Rechnungen</CardTitle>
          <div className="flex gap-2">
            <select 
              value={selectedTyp} 
              onChange={(e) => setSelectedTyp(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="werkstatt">🔧 Werkstatt</option>
              <option value="verkauf">🚗 Verkauf</option>
            </select>
            <Button onClick={handleCreate} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Erstellen
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rechnungen.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Keine Rechnungen vorhanden</p>
        ) : (
          <div className="space-y-3">
            {rechnungen.map(rechnung => (
              <div key={rechnung.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">{rechnung.nummer || 'Rechnung'}</p>
                  <p className="text-sm text-slate-600">
                    {rechnung.typ === 'werkstatt' ? '🔧 Werkstatt' : '🚗 Verkauf'} • {rechnung.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <p className="font-semibold mr-2">{rechnung.summe?.toFixed(2)} €</p>
                  <Button size="sm" variant="ghost">
                    <Printer className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Mail className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Edit2 className="w-4 h-4" />
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
