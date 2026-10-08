export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { initWebPush } from '@/lib/push-vapid'
import { createAdminClient } from '@/lib/supabase/admin'
import { pruefeZugriff } from '@/lib/auftrag-dokumente-server'

// Push-Nachricht an Kollegen des EIGENEN Betriebs (optional nur an bestimmte Mitarbeiter-IDs).
// Der Link darf nur innerhalb der App liegen (sonst wären Phishing-Nachrichten möglich).
export async function POST(req: NextRequest) {
  const zugriff = await pruefeZugriff()
  if ('res' in zugriff) return zugriff.res

  const { title, body, url, tag, userIds } = await req.json().catch(() => ({}))
  const titel = String(title ?? '').slice(0, 120)
  const text = String(body ?? '').slice(0, 300)
  if (!titel) return NextResponse.json({ error: 'title erforderlich' }, { status: 400 })
  const ziel = typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/dashboard'

  if (!initWebPush()) return NextResponse.json({ error: 'Push ist nicht konfiguriert' }, { status: 500 })

  const admin = createAdminClient()
  const { data: mitglieder } = await admin.from('betrieb_users').select('profile_id').eq('betrieb_id', zugriff.betriebId)
  let empfaenger = (mitglieder ?? []).map(m => m.profile_id as string)
  if (Array.isArray(userIds) && userIds.length) empfaenger = empfaenger.filter(id => userIds.includes(id))
  if (empfaenger.length === 0) return NextResponse.json({ sent: 0 })

  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', empfaenger)
  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const payload = JSON.stringify({ title: titel, body: text, url: ziel, tag: typeof tag === 'string' ? tag.slice(0, 60) : undefined })
  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ).catch(async (err) => {
        // Abgelaufene/ungültige Geräte entfernen
        if (err.statusCode === 410 || err.statusCode === 404) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        throw err
      })
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ sent })
}
