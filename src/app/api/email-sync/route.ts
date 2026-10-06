export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { ladeSyncConfig, syncBetrieb } from '@/lib/email-sync'

// Manueller Abruf (Button "E-Mails prüfen" / automatisch beim Öffnen der Rechnungsseite).
// Der tägliche Abruf läuft über GET /api/cron/email-sync.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  let betriebId: string
  try {
    betriebId = await getBetriebIdForUser(supabase, user.id)
  } catch {
    return NextResponse.json({ error: 'Kein Betrieb zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const tage = Number.isFinite(Number(body?.tage)) ? Number(body.tage) : 14

  // Ab hier mit Service-Role: Datei-Ablage und Verarbeitungsprotokoll sind nicht per RLS freigegeben.
  // Der Betrieb stammt ausschließlich aus der Mitgliedschaft des angemeldeten Nutzers.
  const admin = createAdminClient()
  const cfg = await ladeSyncConfig(admin, betriebId)
  if (!cfg.graph_refresh_token) {
    return NextResponse.json(
      { error: 'Microsoft-Konto nicht verbunden. Bitte unter Einstellungen → E-Mail-Postfach verbinden.' },
      { status: 400 },
    )
  }

  try {
    const result = await syncBetrieb(admin, betriebId, cfg, { tage })
    return NextResponse.json({ erfolg: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
