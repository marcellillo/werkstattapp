// VAPID-Zugangsdaten für Web-Push. Werte aus Umgebungsvariablen werden bereinigt: beim Einfügen in die
// Vercel-Einstellungen schleichen sich leicht unsichtbare Zeichen (BOM U+FEFF, Zeilenumbrüche, Leerzeichen,
// Anführungszeichen) ein -- die Push-Bibliothek verwirft die Werte dann als "ungültig" und es kommt nie
// eine Nachricht an.
import webpush from 'web-push'

const bereinige = (v: string | undefined) =>
  (v ?? '').replace(/[​-‍﻿]/g, '').replace(/^["']|["']$/g, '').trim()

export function initWebPush(): boolean {
  const betreff = bereinige(process.env.VAPID_EMAIL)
  const oeffentlich = bereinige(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  const privat = bereinige(process.env.VAPID_PRIVATE_KEY)
  if (!betreff || !oeffentlich || !privat) return false
  webpush.setVapidDetails(/^(mailto:|https:\/\/)/.test(betreff) ? betreff : `mailto:${betreff}`, oeffentlich, privat)
  return true
}

export { webpush }
