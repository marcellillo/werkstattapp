// Push notification handler — injected into the generated service worker by next-pwa
/// <reference lib="webworker" />
export {}

self.addEventListener('push', (e) => {
  const event = e as PushEvent
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'werkstatt',
      data: { url: data.url || '/dashboard' },
      // vibrate not in TS types but supported at runtime
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  const event = e as NotificationEvent
  event.notification.close()
  const url = (event.notification.data as any)?.url || '/dashboard'
  const sw = self as unknown as ServiceWorkerGlobalScope
  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(sw.location.origin) && 'focus' in client) {
          (client as WindowClient).navigate(url)
          return client.focus()
        }
      }
      return sw.clients.openWindow(url)
    })
  )
})
