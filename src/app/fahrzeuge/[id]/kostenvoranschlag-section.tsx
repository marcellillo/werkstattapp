'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Printer, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KostenvoranschlagItem } from '@/components/kostenvoranschlag-item'

interface Props {
  auftragId: string
  betriebId: string
  fahrzeugId: string
}

export function KostenvoranschlagSection({ auftragId, betriebId, fahrzeugId }: Props) {
  const [kostenvoranschlaege, setKostenvoranschlaege] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadKostenvoranschlaege()
  }, [fahrzeugId])

  const loadKostenvoranschlaege = async () => {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('kostenvoranschlaege')
        .select('*')
        .eq('betrieb_id', betriebId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setKostenvoranschlaege(data || [])
    } catch (error) {
      console.error('[KV Load] Error:', error)
    }
  }

  const handleCreate = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/kostenvoranschlag/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auftragId, betriebId, fahrzeugId, typ: 'werkstatt' }),
      })
      const data = await response.json()
      if (!response.ok) {
        console.error('[KV] Error response:', data)
        alert(`Fehler: ${data.error}`)
        return
      }
      if (data.kostenvoranschlag) {
        setKostenvoranschlaege([data.kostenvoranschlag, ...kostenvoranschlaege])
      }
    } catch (error) {
      console.error('[KV] Fetch error:', error)
      alert(`Fehler: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = async (kvId: string) => {
    try {
      const response = await fetch('/api/kostenvoranschlag/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kostenvoranschlagId: kvId, betriebId }),
      })
      if (!response.ok) throw new Error('PDF-Export fehlgeschlagen')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Kostenvoranschlag_${kvId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('PDF-Export Fehler:', error)
      alert('PDF-Export fehlgeschlagen')
    }
  }

  const handleDelete = async (kvId: string) => {
    if (!confirm('Kostenvoranschlag wirklich löschen?')) return
    try {
      const response = await fetch('/api/kostenvoranschlag/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kostenvoranschlagId: kvId, betriebId }),
      })
      if (!response.ok) throw new Error('Fehler beim Löschen')
      setKostenvoranschlaege(kostenvoranschlaege.filter(kv => kv.id !== kvId))
    } catch (error) {
      console.error('Delete error:', error)
      alert('Fehler beim Löschen')
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
              <KostenvoranschlagItem
                key={kv.id}
                kostenvoranschlag={kv}
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
