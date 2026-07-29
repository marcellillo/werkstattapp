'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Printer, Mail, Edit2 } from 'lucide-react'

interface Props {
  auftragId: string
  betriebId: string
}

export function KostenvoranschlagSection({ auftragId, betriebId }: Props) {
  const [kostenvoranschlaege, setKostenvoranschlaege] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/kostenvoranschlag/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auftragId, betriebId, typ: 'werkstatt' }),
      })
      const data = await response.json()
      if (data.kostenvoranschlag) {
        setKostenvoranschlaege([...kostenvoranschlaege, data.kostenvoranschlag])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>📋 Kostenvoranschlag</CardTitle>
          <Button onClick={handleCreate} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Erstellen
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {kostenvoranschlaege.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Kein Kostenvoranschlag vorhanden</p>
        ) : (
          <div className="space-y-3">
            {kostenvoranschlaege.map(kv => (
              <div key={kv.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">{kv.nummer || 'Kostenvoranschlag'}</p>
                  <p className="text-sm text-slate-600">{kv.status}</p>
                </div>
                <div className="flex gap-2">
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
