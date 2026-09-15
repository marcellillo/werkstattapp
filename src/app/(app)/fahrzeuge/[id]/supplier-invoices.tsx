'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBetrieb } from '@/lib/betrieb-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Camera, Trash2, FileText, Image as ImageIcon, Loader2, X, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Zahlungsstatus = 'ausstehend' | 'bezahlt' | 'überfällig'

interface SupplierInvoice {
  id: string
  rechnungsnummer?: string
  lieferant?: string
  rechnungsdatum?: string
  faelligkeitsdatum?: string
  betrag?: number
  zahlungsstatus: Zahlungsstatus
  bezahlt_am?: string
  datei_url: string
  datei_name: string
  datei_typ?: string
  notizen?: string
  erstellt_am: string
}

interface Props {
  fahrzeugId: string
  fahrzeugName: string
}

const STATUS_COLORS: Record<Zahlungsstatus, { bg: string; text: string; icon: React.ReactNode }> = {
  ausstehend: {
    bg: 'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-700',
    icon: <Clock className="w-4 h-4" />,
  },
  bezahlt: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  überfällig: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    icon: <AlertCircle className="w-4 h-4" />,
  },
}

const STATUS_LABELS: Record<Zahlungsstatus, string> = {
  ausstehend: 'Ausstehend',
  bezahlt: 'Bezahlt',
  überfällig: 'Überfällig',
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
  const [updating, setUpdating] = useState<string | null>(null)

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

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)

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
      const fileName = `${fahrzeugId}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('supplier-invoice')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('supplier-invoice')
        .getPublicUrl(fileName)

      const { error: dbError } = await supabase.from('supplier_invoices').insert({
        betrieb_id: currentBetriebId,
        fahrzeug_id: fahrzeugId,
        datei_url: urlData.publicUrl,
        datei_name: file.name,
        datei_typ: file.type.startsWith('image/') ? 'image' : 'pdf',
        zahlungsstatus: 'ausstehend',
      })

      if (dbError) throw dbError

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

  // Update payment status
  const handleStatusChange = async (id: string, newStatus: Zahlungsstatus) => {
    setUpdating(id)

    const updates: any = { zahlungsstatus: newStatus }
    if (newStatus === 'bezahlt') {
      updates.bezahlt_am = new Date().toISOString().split('T')[0]
    } else {
      updates.bezahlt_am = null
    }

    const { error } = await supabase
      .from('supplier_invoices')
      .update(updates)
      .eq('id', id)

    setUpdating(null)

    if (error) {
      alert(`Fehler: ${error.message}`)
      return
    }

    await loadInvoices()
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
          invoices.map((invoice) => {
            const statusColor = STATUS_COLORS[invoice.zahlungsstatus]
            const isFällig =
              invoice.faelligkeitsdatum &&
              new Date(invoice.faelligkeitsdatum) < new Date() &&
              invoice.zahlungsstatus !== 'bezahlt'

            return (
              <div
                key={invoice.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                  isFällig ? 'border-red-300 bg-red-50' : statusColor.bg
                }`}
              >
                {/* Status Icon */}
                <div className={`text-sm ${statusColor.text}`}>
                  {statusColor.icon}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {invoice.lieferant || invoice.datei_name}
                    </p>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        invoice.zahlungsstatus === 'bezahlt'
                          ? 'bg-green-200 text-green-800'
                          : invoice.zahlungsstatus === 'überfällig'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-yellow-200 text-yellow-800'
                      }`}
                    >
                      {STATUS_LABELS[invoice.zahlungsstatus]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {invoice.rechnungsnummer && `Rech: ${invoice.rechnungsnummer} · `}
                    {invoice.rechnungsdatum && `${new Date(invoice.rechnungsdatum).toLocaleDateString('de-DE')} · `}
                    {invoice.betrag && `€${invoice.betrag.toFixed(2)}`}
                    {invoice.faelligkeitsdatum && ` · Fällig: ${new Date(invoice.faelligkeitsdatum).toLocaleDateString('de-DE')}`}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {/* Status Buttons */}
                  <div className="flex gap-0.5">
                    {(['ausstehend', 'bezahlt', 'überfällig'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(invoice.id, status)}
                        disabled={updating === invoice.id}
                        className={`px-2 py-1 text-xs rounded transition ${
                          invoice.zahlungsstatus === status
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                        title={STATUS_LABELS[status]}
                      >
                        {status === 'ausstehend' ? '⏳' : status === 'bezahlt' ? '✅' : '⚠️'}
                      </button>
                    ))}
                  </div>

                  {/* File & Delete */}
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
            )
          })
        )}
      </div>

      {/* Summary */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center py-2 bg-yellow-50 rounded-lg">
            <p className="text-xs text-slate-600">Ausstehend</p>
            <p className="text-lg font-bold text-yellow-700">
              {invoices.filter((i) => i.zahlungsstatus === 'ausstehend').length}
            </p>
          </div>
          <div className="text-center py-2 bg-green-50 rounded-lg">
            <p className="text-xs text-slate-600">Bezahlt</p>
            <p className="text-lg font-bold text-green-700">
              {invoices.filter((i) => i.zahlungsstatus === 'bezahlt').length}
            </p>
          </div>
          <div className="text-center py-2 bg-red-50 rounded-lg">
            <p className="text-xs text-slate-600">Überfällig</p>
            <p className="text-lg font-bold text-red-700">
              {invoices.filter((i) => i.zahlungsstatus === 'überfällig').length}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
