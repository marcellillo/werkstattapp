'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Printer, Mail, Edit2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

  const handleSendEmail = (kvId: string, kvNummer: string) => {
    const subject = `Kostenvoranschlag ${kvNummer}`
    const body = `Guten Tag,\n\nhier ist Ihr Kostenvoranschlag ${kvNummer}.\n\nMit freundlichen Grüßen`
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailtoLink
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
                <div className="flex-1">
                  <p className="font-medium">{kv.nummer || 'Kostenvoranschlag'}</p>
                  <p className="text-sm text-slate-600">{kv.status || 'entwurf'}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => handleExportPDF(kv.id)} title="Als PDF drucken">
                    <Printer className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleSendEmail(kv.id, kv.nummer)} title="Per E-Mail versenden">
                    <Mail className="w-4 h-4" />
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
