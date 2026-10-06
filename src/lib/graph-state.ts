// Signierter OAuth-"state" für die Microsoft-Anmeldung: bindet den Rückweg an den Betrieb UND an
// den Browser, der die Anmeldung gestartet hat (Nonce im httpOnly-Cookie). Ohne das könnte jemand
// einem angemeldeten Admin einen Rückkehr-Link mit fremdem Code unterschieben und so ein fremdes
// Postfach mit dem Betrieb verbinden.
import { createHmac, randomUUID, timingSafeEqual } from 'crypto'

export const GRAPH_NONCE_COOKIE = 'graph_oauth_nonce'

function signatur(betriebId: string, nonce: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Server-Konfiguration unvollständig')
  return createHmac('sha256', secret).update(`${betriebId}.${nonce}`).digest('hex')
}

export function erzeugeState(betriebId: string): { state: string; nonce: string } {
  const nonce = randomUUID()
  return { state: `${betriebId}.${nonce}.${signatur(betriebId, nonce)}`, nonce }
}

export function pruefeState(state: string | null, cookieNonce: string | undefined): string | null {
  if (!state || !cookieNonce) return null
  const [betriebId, nonce, sig] = state.split('.')
  if (!betriebId || !nonce || !sig || nonce !== cookieNonce) return null
  const erwartet = Buffer.from(signatur(betriebId, nonce))
  const erhalten = Buffer.from(sig)
  if (erwartet.length !== erhalten.length || !timingSafeEqual(erwartet, erhalten)) return null
  return betriebId
}
