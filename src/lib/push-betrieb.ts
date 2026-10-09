// Push-Nachricht an alle Mitarbeiter eines Betriebs (Server, ohne Nutzer-Sitzung — z. B. wenn ein Kunde etwas freigibt).
// Schlägt nie hart fehl: Benachrichtigungen dürfen den eigentlichen Vorgang nicht blockieren.
import webpush from 'web-push'
import { initWebPush } from '@/lib/push-vapid'
import { createAdminClient } from '@/lib/supabase/admin'

export async function pushAnBetrieb(betriebId: string, nachricht: { title: string; body: string; url: string; tag?: string }) {
  try {
    if (!initWebPush()) return 0
    const admin = createAdminClient()
    const { data: mitglieder } = await admin.from('betrieb_users').select('profile_id').eq('betrieb_id', betriebId)
    const ids = (mitglieder ?? []).map(m => m.profile_id as string)
    if (!ids.length) return 0
    const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', ids)
    if (!subs?.length) return 0
    const payload = JSON.stringify({ title: nachricht.title.slice(0, 120), body: nachricht.body.slice(0, 300), url: nachricht.url, tag: nachricht.tag })
    const ergebnis = await Promise.allSettled(subs.map(sub =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        .catch(async (err: any) => {
          if (err?.statusCode === 410 || err?.statusCode === 404) await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          throw err
        })))
    return ergebnis.filter(r => r.status === 'fulfilled').length
  } catch (e: any) {
    console.error('[push-betrieb]', e?.message ?? e)
    return 0
  }
}
