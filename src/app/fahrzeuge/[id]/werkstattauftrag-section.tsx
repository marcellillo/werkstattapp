'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { WerkstattauftragItem } from '@/components/werkstattauftrag-item'

interface Props {
  auftragId: string
  betriebId: string
  fahrzeugId: string
}

export function WerkstattauftragSection({ auftragId, betriebId, fahrzeugId }: Props) {
  const [auftraege, setAuftraege] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadWerkstattauftraege()
  }, [fahrzeugId])

  const loadWerkstattauftraege = async () => {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('werkstattauftraege')
        .select('*')
        .eq('betrieb_id', betriebId)
        .eq('fahrzeug_id', fahrzeugId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAuftraege(data || [])
    } catch (error) {
      console.error('[WA Load] Error:', error)
    }
  }

  const handleCreate = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/werkstattauftrag/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auftragId, betriebId, fahrzeugId }),
      })
      const data = await response.json()
      if (!response.ok) {
        console.error('[WA] Error response:', data)
        alert(`Fehler: ${data.error}`)
        return
      }
      if (data.werkstattauftrag) {
        setAuftraege([data.werkstattauftrag, ...auftraege])
      }
    } catch (error) {
      console.error('[WA] Fetch error:', error)
      alert(`Fehler: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (waId: string) => {
    if (!confirm('Werkstattauftrag wirklich löschen?')) return
    try {
      const response = await fetch('/api/werkstattauftrag/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ werkstattauftragId: waId, betriebId }),
      })
      if (!response.ok) throw new Error('Fehler beim Löschen')
      setAuftraege(auftraege.filter(a => a.id !== waId))
    } catch (error) {
      console.error('Delete error:', error)
      alert('Fehler beim Löschen')
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
              <WerkstattauftragItem
                key={auftrag.id}
                werkstattauftrag={auftrag}
                betriebId={betriebId}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
