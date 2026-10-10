// Einfaches, datenbankbasiertes Rate-Limit (festes Zeitfenster). Funktioniert auch bei mehreren
// Serverless-Instanzen, weil der Zähler in Supabase liegt (Funktion rate_limit_pruefen, nur Service-Role).
// Fällt die Prüfung selbst aus, wird NICHT blockiert (die Werkstatt soll weiterarbeiten können).
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** IP des Aufrufers. Vercel überschreibt x-forwarded-for selbst, der Wert ist nicht vom Client fälschbar. */
export function clientIp(req: Request): string {
  const roh = req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
  return roh.split(',')[0].trim().slice(0, 64) || 'unbekannt'
}

/**
 * Zählt einen Aufruf. Gibt eine fertige 429-Antwort zurück, wenn das Limit überschritten ist, sonst null.
 * Nutzung:  const limit = await rateLimit(`beispiel:${user.id}`, 30, 600); if (limit) return limit
 */
export async function rateLimit(schluessel: string, max: number, fensterSekunden: number): Promise<NextResponse | null> {
  try {
    const { data, error } = await createAdminClient().rpc('rate_limit_pruefen', {
      p_schluessel: schluessel,
      p_max: max,
      p_fenster_sekunden: fensterSekunden,
    })
    if (error) {
      console.error('[rate-limit] Prüfung fehlgeschlagen:', error.message)
      return null
    }
    if (data === false) {
      return NextResponse.json(
        { error: 'Zu viele Anfragen. Bitte kurz warten und dann erneut versuchen.' },
        { status: 429, headers: { 'Retry-After': String(fensterSekunden) } },
      )
    }
  } catch (e: any) {
    console.error('[rate-limit] Fehler:', e?.message ?? e)
  }
  return null
}
