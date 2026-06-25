import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { RechnungenContent } from './rechnungen-content'

export default async function RechnungenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rechnungen } = await supabase
    .from('rechnungen')
    .select(`*, positionen:rechnung_positionen(*)`)
    .order('erstellt_am', { ascending: false })

  const isAdmin = true // App ist passwortgeschützt — alle eingeloggten Nutzer dürfen löschen

  return (
    <AppLayout title="Rechnungen">
      <RechnungenContent rechnungen={(rechnungen ?? []) as any[]} isAdmin={isAdmin} />
    </AppLayout>
  )
}
