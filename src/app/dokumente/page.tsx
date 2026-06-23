// @ts-nocheck
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { FileText, Download, Image, File } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

export default async function DokumentePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: attachments } = await supabase
    .from('project_attachments')
    .select('*, project:projects(title, project_number)')
    .order('created_at', { ascending: false })
    .limit(100)

  function getFileIcon(fileType: string) {
    if (fileType.startsWith('image/')) return <Image className="w-5 h-5 text-blue-500" />
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />
    return <File className="w-5 h-5 text-gray-800" />
  }

  function formatSize(bytes?: number) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <AppLayout title="Dokumente">
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{attachments?.length ?? 0} Dokumente</h2>
          <p className="text-sm text-gray-800">Alle Projektdokumente und Fotos zentral verwaltet</p>
        </div>

        {!attachments || attachments.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-800">Noch keine Dokumente vorhanden</p>
            <p className="text-sm text-gray-600">Dokumente werden automatisch beim Hinzufügen von Baustellenupdates gespeichert.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {attachments.map(att => (
              <Card key={att.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {getFileIcon(att.file_type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{att.file_name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
                        {(att.project as { title?: string; project_number?: string })?.project_number && (
                          <span className="font-mono">{(att.project as { title?: string; project_number?: string }).project_number}</span>
                        )}
                        {(att.project as { title?: string })?.title && (
                          <span className="truncate">{(att.project as { title?: string }).title}</span>
                        )}
                        {att.file_size && <span>{formatSize(att.file_size)}</span>}
                        <span>{formatDateTime(att.created_at)}</span>
                      </div>
                    </div>
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-700"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

