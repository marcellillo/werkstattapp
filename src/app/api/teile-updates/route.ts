export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('werkstatt_einstellungen')
    .select('wert')
    .eq('schluessel', 'teile_updates_ausstehend')
    .maybeSingle()

  const updates = data?.wert ? JSON.parse(data.wert) : []
  return NextResponse.json({ updates })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, aktion } = await req.json()

  const { data } = await supabase
    .from('werkstatt_einstellungen')
    .select('wert')
    .eq('schluessel', 'teile_updates_ausstehend')
    .maybeSingle()

  const updates: any[] = data?.wert ? JSON.parse(data.wert) : []
  const update = updates.find((u: any) => u.id === id)
  if (!update) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  if (aktion === 'bestaetigen') {
    const statusReihenfolge = ['nicht_bestellt', 'bestellt', 'unterwegs', 'geliefert', 'eingebaut']

    for (const teil of update.teile) {
      if (teil.vorhanden_id) {
        const { data: vorh } = await supabase.from('ersatzteile').select('status').eq('id', teil.vorhanden_id).maybeSingle()
        if (vorh) {
          const aktuellIdx = statusReihenfolge.indexOf(vorh.status)
          const neuIdx = statusReihenfolge.indexOf(update.neuer_status)
          if (neuIdx > aktuellIdx) {
            await supabase.from('ersatzteile').update({
              status: update.neuer_status,
              lieferant: update.lieferant,
              ...(update.neuer_status === 'geliefert' ? { geliefert_am: new Date().toISOString().split('T')[0] } : {}),
              ...(update.neuer_status === 'bestellt' ? { bestellt_am: new Date().toISOString().split('T')[0] } : {}),
            }).eq('id', teil.vorhanden_id)
          }
        }
      } else if (update.auftrag_id) {
        await supabase.from('ersatzteile').insert({
          auftrag_id: update.auftrag_id,
          bezeichnung: teil.bezeichnung,
          teilenummer: teil.teilenummer ?? null,
          lieferant: update.lieferant,
          menge: teil.menge ?? 1,
          einzelpreis: teil.einzelpreis ?? null,
          status: update.neuer_status,
          bestellt_am: update.neuer_status === 'bestellt' ? new Date().toISOString().split('T')[0] : null,
          geliefert_am: update.neuer_status === 'geliefert' ? new Date().toISOString().split('T')[0] : null,
        })
      }
    }

    if (update.neuer_status === 'geliefert' && update.auftrag_id) {
      await supabase.from('benachrichtigungen').insert({
        titel: `Teile eingetroffen: ${update.lieferant}`,
        nachricht: `Lieferung von ${update.lieferant}: ${update.teile.map((t: any) => t.bezeichnung).join(', ')}`,
        typ: 'teil_eingetroffen',
        auftrag_id: update.auftrag_id,
        gelesen: false,
      })
    }
  }

  if (update.protokoll_id) {
    await supabase.from('email_protokoll')
      .update({ verarbeitet: true })
      .eq('id', update.protokoll_id)
  }

  const restUpdates = updates.filter((u: any) => u.id !== id)
  await supabase.from('werkstatt_einstellungen').upsert(
    { schluessel: 'teile_updates_ausstehend', wert: JSON.stringify(restUpdates) },
    { onConflict: 'schluessel' }
  )

  return NextResponse.json({ erfolg: true, aktion, restlich: restUpdates.length })
}
