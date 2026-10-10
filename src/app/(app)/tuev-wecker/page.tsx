import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TuevWeckerContent } from './tuev-wecker-content'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { ladeErinnerungen } from '@/lib/erinnerungen-server'
import { resolveFirmaSettings } from '@/lib/firma-settings'

export default async function TuevWeckerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const [{ data: fahrzeugeRaw }, { data: ohneHuRaw }, erinnerungen, firma] = await Promise.all([
    supabase
      .from('fahrzeuge')
      .select('id, betrieb_id, kennzeichen, marke, modell, naechste_hauptuntersuchung, tuev_erinnerung, kunden_id, kunde:kunden(id, vorname, nachname, telefon, mobil, email)')
      .eq('betrieb_id', betriebId)
      .not('naechste_hauptuntersuchung', 'is', null)
      .neq('tuev_erinnerung', false)
      .order('naechste_hauptuntersuchung', { ascending: true }),
    // Kundenfahrzeuge ohne HU-Datum: ohne Datum kann der Wecker nicht erinnern -> hier schnell nachtragen
    supabase
      .from('fahrzeuge')
      .select('id, betrieb_id, kennzeichen, marke, modell, baujahr, kunden_id, kunde:kunden(id, vorname, nachname, telefon, mobil, email)')
      .eq('betrieb_id', betriebId)
      .is('naechste_hauptuntersuchung', null)
      .or('fahrzeug_typ.is.null,fahrzeug_typ.neq.eigen')
      .order('kennzeichen'),
    ladeErinnerungen(supabase, betriebId, 'hu'),
    resolveFirmaSettings(supabase, betriebId),
  ])

  return (
    <TuevWeckerContent
      fahrzeuge={(fahrzeugeRaw ?? []) as any[]}
      ohneHu={(ohneHuRaw ?? []) as any[]}
      erinnerungen={erinnerungen}
      firmaName={firma.firma_name ?? ''}
    />
  )
}
