export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Gerät für Push-Nachrichten an- bzw. abmelden. Geschrieben wird mit Service-Role, aber IMMER für den
// angemeldeten Nutzer (ein Gerät kann zwischen Konten wechseln, der Endpunkt ist eindeutig).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subscription = await req.json().catch(() => null)
  const endpoint = subscription?.endpoint, p256dh = subscription?.keys?.p256dh, auth = subscription?.keys?.auth
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return NextResponse.json({ error: 'Ungültiges Abo' }, { status: 400 })
  }

  const { error } = await createAdminClient().from('push_subscriptions').upsert({
    user_id: user.id, endpoint, p256dh, auth,
  }, { onConflict: 'endpoint' })
  if (error) return NextResponse.json({ error: 'Abo konnte nicht gespeichert werden' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json().catch(() => ({}))
  if (typeof endpoint !== 'string') return NextResponse.json({ error: 'endpoint fehlt' }, { status: 400 })
  // Nur das eigene Abo entfernen
  await createAdminClient().from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
