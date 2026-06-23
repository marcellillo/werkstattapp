import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { BenachrichtigungenContent } from './benachrichtigungen-content'

export default async function BenachrichtigungenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Notifications generieren (server-side beim Seitenaufruf)
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await fetch(`${baseUrl}/api/benachrichtigungen/generieren`, {
      method: 'POST',
      headers: { Cookie: '' }, // wird durch supabase session gehandelt
    })
  } catch {}

  const { data: notifications } = await supabase
    .from('benachrichtigungen')
    .select('*')
    .or(`benutzer_id.eq.${user.id},benutzer_id.is.null`)
    .order('erstellt_am', { ascending: false })
    .limit(100)

  const unread = (notifications ?? []).filter(n => !n.gelesen)

  if (unread.length > 0) {
    await supabase
      .from('benachrichtigungen')
      .update({ gelesen: true })
      .or(`benutzer_id.eq.${user.id},benutzer_id.is.null`)
      .eq('gelesen', false)
  }

  return (
    <AppLayout title="Benachrichtigungen">
      <BenachrichtigungenContent
        notifications={notifications ?? []}
        unreadCount={unread.length}
      />
    </AppLayout>
  )
}
