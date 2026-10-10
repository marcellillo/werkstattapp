// Fertige Exporte (ZIP) kurz im privaten Bucket "exporte" ablegen und als kurzlebigen Download-Link ausliefern.
// (Direkt als Antwort wären sie wegen der 4,5-MB-Grenze von Serverfunktionen oft zu groß.)
import { createAdminClient } from '@/lib/supabase/admin'

export const EXPORT_BUCKET = 'exporte'
const AUFBEWAHRUNG_MS = 24 * 3600 * 1000

export async function exportAblegen(betriebId: string, dateiname: string, zip: Buffer): Promise<{ downloadUrl: string }> {
  const admin = createAdminClient()
  const pfad = `${betriebId}/${Date.now()}-${dateiname}`
  const { error } = await admin.storage.from(EXPORT_BUCKET).upload(pfad, zip, { contentType: 'application/zip', upsert: false })
  if (error) throw error

  // alte Exporte dieses Betriebs (älter als 24 Stunden) wegräumen -- sie enthalten Kunden- und Finanzdaten
  try {
    const { data: liste } = await admin.storage.from(EXPORT_BUCKET).list(betriebId, { limit: 100 })
    const alt = (liste ?? []).filter(f => {
      const t = Number(/^(\d{13})-/.exec(f.name)?.[1])
      return Number.isFinite(t) && Date.now() - t > AUFBEWAHRUNG_MS
    })
    if (alt.length) await admin.storage.from(EXPORT_BUCKET).remove(alt.map(f => `${betriebId}/${f.name}`))
  } catch (e) {
    console.error('[export] Aufräumen alter Exporte fehlgeschlagen:', e)
  }

  const { data, error: linkFehler } = await admin.storage.from(EXPORT_BUCKET).createSignedUrl(pfad, 600, { download: dateiname })
  if (linkFehler || !data) throw linkFehler ?? new Error('Download-Link fehlt')
  return { downloadUrl: data.signedUrl }
}
