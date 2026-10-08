import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { serverFehler } from '@/lib/api-fehler'

// Azure-Zugangsdaten und Automatik-Schalter für das E-Mail-Postfach (nur Admins).
// Das Client-Secret wird nur überschrieben, wenn ein neues mitgeschickt wird.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  let betriebId: string
  try {
    betriebId = await getBetriebIdForUser(supabase, user.id)
  } catch {
    return NextResponse.json({ error: 'Kein Betrieb zugeordnet' }, { status: 403 })
  }

  const { data: mitglied } = await supabase
    .from('betrieb_users').select('role').eq('betrieb_id', betriebId).eq('profile_id', user.id).maybeSingle()
  if (mitglied?.role !== 'admin' && mitglied?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Nur Administratoren dürfen das ändern' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const zeilen: { betrieb_id: string; schluessel: string; wert: string }[] = []
  const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (body.clientId !== undefined) {
    const v = String(body.clientId).trim()
    if (!guid.test(v)) return NextResponse.json({ error: 'Die Anwendungs-ID (Client-ID) hat ein ungültiges Format' }, { status: 400 })
    zeilen.push({ betrieb_id: betriebId, schluessel: 'graph_client_id', wert: v })
  }
  if (body.tenantId !== undefined) {
    const v = String(body.tenantId).trim()
    if (!guid.test(v)) return NextResponse.json({ error: 'Die Verzeichnis-ID (Tenant-ID) hat ein ungültiges Format' }, { status: 400 })
    zeilen.push({ betrieb_id: betriebId, schluessel: 'graph_tenant_id', wert: v })
  }
  if (typeof body.clientSecret === 'string' && body.clientSecret.trim()) {
    zeilen.push({ betrieb_id: betriebId, schluessel: 'graph_client_secret', wert: body.clientSecret.trim() })
  }
  if (typeof body.aktiv === 'boolean') {
    zeilen.push({ betrieb_id: betriebId, schluessel: 'email_sync_aktiv', wert: body.aktiv ? 'true' : 'false' })
  }
  if (zeilen.length === 0) return NextResponse.json({ error: 'Nichts zu speichern' }, { status: 400 })

  const { error } = await createAdminClient()
    .from('betrieb_einstellungen').upsert(zeilen, { onConflict: 'betrieb_id,schluessel' })
  if (error) return serverFehler(error, 'graph/config')
  return NextResponse.json({ erfolg: true })
}
