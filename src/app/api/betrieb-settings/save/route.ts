import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { betriebId, config } = await req.json()

    if (!betriebId || !config) {
      return NextResponse.json({ error: 'betriebId and config required' }, { status: 400 })
    }

    // Verify user is admin of betrieb
    const { data: userRole } = await supabase
      .from('betrieb_users')
      .select('role')
      .eq('betrieb_id', betriebId)
      .eq('profile_id', user.id)
      .single()

    if (userRole?.role !== 'admin' && userRole?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only admins can update settings' }, { status: 403 })
    }

    // Microsoft-Postfach und E-Mail-Sync-Zustand werden NUR über /api/graph/* und den Sync selbst
    // geschrieben. Die Einstellungsseite schickt beim Speichern ihren ganzen (evtl. veralteten)
    // Stand mit -- der darf eine frisch hergestellte Verbindung nicht überschreiben.
    const GESCHUETZT = /^graph_|^(email_sync_aktiv|letzter_email_sync|teile_updates_ausstehend)$/

    // Upsert settings as key-value pairs
    const updates = Object.entries(config)
      .filter(([schluessel]) => !GESCHUETZT.test(schluessel))
      .map(([schluessel, wert]) => ({
        betrieb_id: betriebId,
        schluessel,
        wert: String(wert),
      }))
    if (updates.length === 0) return NextResponse.json({ success: true })

    const { error } = await supabase
      .from('betrieb_einstellungen')
      .upsert(updates, {
        onConflict: 'betrieb_id,schluessel'
      })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Settings Save] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
