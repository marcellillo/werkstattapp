import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveFirmaSettings } from '@/lib/firma-settings'
import { clientIp, rateLimit } from '@/lib/rate-limit'

// Oeffentliche, unauthentifizierte Status-Abfrage fuer den Kunden-Tracking-Link
// (/status/[id]). Die normale RLS-geschuetzte auftraege-Tabelle verlangt eine
// betrieb_users-Mitgliedschaft -- ein echter, nicht eingeloggter Kunde kommt
// darueber nie an seine Daten. Diese Route nutzt bewusst den Admin-Client,
// gibt aber nur die fuer die Status-Ansicht noetigen, unkritischen Felder
// zurueck (kein Kunde, keine Preise, keine internen Notizen).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Nur echte Auftrags-IDs (UUID) -- schützt vor Probieren/Fehlern und spart Datenbankaufrufe
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Auftrag nicht gefunden' }, { status: 404 })
  }
  const limit = await rateLimit(`status:${clientIp(req)}`, 120, 600)
  if (limit) return limit
  const supabase = createAdminClient()

  const { data: auftrag } = await supabase
    .from('auftraege')
    .select('id, status, arbeiten, erstellt_am, betrieb_id, fahrzeug:fahrzeuge(kennzeichen, marke, modell)')
    .eq('id', id)
    .maybeSingle()

  if (!auftrag) return NextResponse.json({ error: 'Auftrag nicht gefunden' }, { status: 404 })

  const cfg = await resolveFirmaSettings(supabase, auftrag.betrieb_id)

  return NextResponse.json({
    id: auftrag.id,
    status: auftrag.status,
    beschreibung: auftrag.arbeiten,
    erstellt_am: auftrag.erstellt_am,
    fahrzeug: auftrag.fahrzeug,
    betrieb: {
      name: cfg.firma_name || 'Werkstatt',
      firma_telefon: cfg.firma_telefon || '',
      firma_email: cfg.firma_email || '',
    },
  })
}
