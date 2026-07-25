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
      // Upload to storage
      const fileName = etrieb-logos/\/\_\
      const { error: uploadError } = await supabase.storage
        .from('betrieb-logos')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('betrieb-logos')
        .getPublicUrl(fileName)

      // Update betriebe table
      const { error: updateError } = await supabase
        .from('betriebe')
        .update({ logo_url: urlData.publicUrl })
        .eq('id', currentBetriebId)

      if (updateError) throw updateError

      setLogoPreview(urlData.publicUrl)
      setMessage({ type: 'success', text: 'Logo erfolgreich hochgeladen!' })

      // Reload nach 2s damit Logo überall aktualisiert wird
      setTimeout(() => window.location.reload(), 2000)
    } catch (error) {
      setMessage({ type: 'error', text: \Fehler: \\ })
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!currentBetriebId) return

    setUploading(true)
    try {
      const { error } = await supabase
        .from('betriebe')
        .update({ logo_url: null })
        .eq('id', currentBetriebId)

      if (error) throw error

      setLogoPreview(null)
      setMessage({ type: 'success', text: 'Logo entfernt!' })
      setTimeout(() => window.location.reload(), 2000)
    } catch (error) {
      setMessage({ type: 'error', text: \Fehler: \\ })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Einstellungen</h1>
        <p className="text-slate-600 mt-1">Betrieb-Konfiguration für {betrieb?.name}</p>
      </div>

      {/* Logo Settings Card */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Betrieb-Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Laden Sie hier Ihr Werkstatt-Logo hoch. Es wird überall in der App angezeigt.
          </p>

          {/* Logo Preview */}
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

          {/* Upload Button */}
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

          {/* Message */}
          {message && (
            <div
              className={p-3 rounded-lg text-sm \}
            >
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
