'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBetrieb } from '@/lib/betrieb-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, X } from 'lucide-react'

interface Props {
  betrieb: any
}

export function EinstellungenContent({ betrieb }: Props) {
  const { currentBetriebId } = useBetrieb()
  const supabase = createClient()

  const [logoPreview, setLogoPreview] = useState<string | null>(betrieb?.logo_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentBetriebId) return

    setUploading(true)
    setMessage(null)

    try {
      const fileName = `betrieb-logos/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('betrieb-logos')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('betrieb-logos')
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('betriebe')
        .update({ logo_url: urlData.publicUrl })
        .eq('id', currentBetriebId)

      if (updateError) throw updateError

      setLogoPreview(urlData.publicUrl)
      setMessage({ type: 'success', text: 'Logo erfolgreich hochgeladen!' })
      setTimeout(() => window.location.reload(), 1500)
    } catch (error: any) {
      setMessage({ type: 'error', text: `Fehler: ${error.message}` })
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!currentBetriebId) return

    setUploading(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('betriebe')
        .update({ logo_url: null })
        .eq('id', currentBetriebId)

      if (error) throw error

      setLogoPreview(null)
      setMessage({ type: 'success', text: 'Logo entfernt!' })
      setTimeout(() => window.location.reload(), 1500)
    } catch (error: any) {
      setMessage({ type: 'error', text: `Fehler: ${error.message}` })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">⚙️ Einstellungen</h1>
        <p className="text-slate-600 mt-1">{betrieb?.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Betrieb-Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Laden Sie hier Ihr Werkstatt-Logo hoch. Es wird überall in der App angezeigt.
          </p>

          {message && (
            <div
              className={`p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {logoPreview && (
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <img
                src={logoPreview}
                alt="Logo"
                className="h-20 w-20 object-contain"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Logo aktiv</p>
                <p className="text-xs text-slate-500">Wird in der App angezeigt</p>
              </div>
              <button
                onClick={handleRemoveLogo}
                disabled={uploading}
                className="p-2 hover:bg-red-100 rounded transition text-red-600"
                title="Logo entfernen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoSelect}
              disabled={uploading}
              className="hidden"
            />
            <Button variant="outline" asChild disabled={uploading}>
              <span>
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wird hochgeladen...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Logo hochladen
                  </>
                )}
              </span>
            </Button>
          </label>
        </CardContent>
      </Card>
    </div>
  )
}
