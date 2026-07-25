'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBetrieb } from '@/lib/betrieb-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Camera, Trash2, FileText, Image as ImageIcon, Loader2, X } from 'lucide-react'

interface SupplierInvoice {
  id: string
  rechnungsnummer?: string
  lieferant?: string
  rechnungsdatum?: string
  betrag?: number
  datei_url: string
  datei_name: string
  datei_typ?: string
  erstellt_am: string
}

interface Props {
  fahrzeugId: string
  fahrzeugName: string
}

export function SupplierInvoices({ fahrzeugId, fahrzeugName }: Props) {
  const { currentBetriebId } = useBetrieb()
  const supabase = createClient()

  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // Load invoices
  const loadInvoices = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('supplier_invoices')
      .select('*')
      .eq('fahrzeug_id', fahrzeugId)
      .order('erstellt_am', { ascending: false })
    setInvoices(data ?? [])
    setLoading(false)
  }

  // Handle file selection (from file picker or camera)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(selectedFile)
    setShowDialog(true)
  }

  // Upload to Supabase Storage
  const handleUpload = async () => {
    if (!file || !currentBetriebId) return
    setUploading(true)

    try {
      // Upload to storage
      const fileName = `${fahrzeugId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('supplier-invoices')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('supplier-invoices')
        .getPublicUrl(fileName)

      // Save to database
      const { error: dbError } = await supabase.from('supplier_invoices').insert({
        betrieb_id: currentBetriebId,
        fahrzeug_id: fahrzeugId,
        datei_url: urlData.publicUrl,
        datei_name: file.name,
        datei_typ: file.type.startsWith('image/') ? 'image' : 'pdf',
      })

      if (dbError) throw dbError

      // Refresh list
      await loadInvoices()
      setShowDialog(false)
      setFile(null)
      setPreview(null)
    } catch (error) {
      alert(`Upload-Fehler: ${error}`)
    } finally {
      setUploading(false)
    }
  }

  // Delete invoice
  const handleDelete = async (id: string) => {
    if (!confirm('Rechnung wirklich löschen?')) return

    const { error } = await supabase.from('supplier_invoices').delete().eq('id', id)
    if (error) {
      alert(`Fehler: ${error.message}`)
      return
    }

    await loadInvoices()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">📄 Lieferanten-Rechnungen</h3>
        <div className="flex gap-2">
          {/* Camera Button */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button variant="outline" size="sm" asChild>
              <span>
                <Camera className="w-4 h-4 mr-2" />
                Scannen
              </span>
            </Button>
          </label>

          {/* File Upload Button */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Datei
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Upload Dialog */}
      {showDialog && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Datei hochladen</h4>
              <button
                onClick={() => {
                  setShowDialog(false)
                  setFile(null)
                  setPreview(null)
                }}
                className="p-1 hover:bg-blue-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {preview && (
              <div className="max-h-48 overflow-auto bg-white rounded border">
                {file?.type.startsWith('image/') ? (
                  <img src={preview} alt="preview" className="w-full" />
                ) : (
                  <div className="p-4 text-center text-slate-600">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    {file?.name}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false)
                  setFile(null)
                  setPreview(null)
                }}
                disabled={uploading}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wird hochgeladen...
                  </>
                ) : (
                  'Hochladen'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-4 text-slate-500">Wird geladen...</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-lg text-slate-500">
            Noch keine Rechnungen hochgeladen
          </div>
        ) : (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
            >
              {invoice.datei_typ === 'image' ? (
                <ImageIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
              ) : (
                <FileText className="w-5 h-5 text-red-600 flex-shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {invoice.datei_name}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(invoice.erstellt_am).toLocaleDateString('de-DE')}
                  {invoice.lieferant && ` · ${invoice.lieferant}`}
                </p>
              </div>

              <div className="flex gap-1">
                <a
                  href={invoice.datei_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-slate-200 rounded transition"
                  title="Öffnen"
                >
                  <FileText className="w-4 h-4 text-slate-600" />
                </a>
                <button
                  onClick={() => handleDelete(invoice.id)}
                  className="p-2 hover:bg-red-100 rounded transition text-red-600"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
