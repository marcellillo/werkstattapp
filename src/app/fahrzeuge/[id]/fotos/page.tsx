import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { FotosContent } from './fotos-content'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function FotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: auftrag }, { data: fotos }] = await Promise.all([
    supabase.from('auftraege').select('auftrag_nr, fahrzeug:fahrzeuge(marke, modell, kennzeichen)').eq('id', id).single(),
    supabase.from('auftrag_fotos').select('*').eq('auftrag_id', id).order('erstellt_am'),
  ])

  if (!auftrag) notFound()
  const fz = (auftrag as any).fahrzeug
  const title = fz ? `${fz.marke} ${fz.modell} · Fotos` : 'Fotos'

  return (
    <AppLayout title={title}>
      <div className="max-w-2xl mx-auto">
        <Link href={`/fahrzeuge/${id}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft className="w-4 h-4" />Zurück zum Auftrag
        </Link>
        <FotosContent auftragId={id} initialFotos={(fotos ?? []) as any[]} />
      </div>
    </AppLayout>
  )
}
