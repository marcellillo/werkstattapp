import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BuchhaltungContent } from './buchhaltung-content'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { resolveFirmaSettings } from '@/lib/firma-settings'

export default async function BuchhaltungPage({ searchParams }: { searchParams: Promise<{ tab?: string; filter?: string }> }) {
  const { tab, filter } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const [
    { data: auftraege },
    { data: ausgaben },
    { data: kundenRechnungen },
    { data: erinnerungenRaw },
    cfg,
  ] = await Promise.all([
    supabase
      .from('auftraege')
      .select('id, auftrag_nr, einnahmen, erstellt_am, verkauft_am, status, steuerart, fahrzeug:fahrzeuge(kennzeichen, marke, modell, mobile_de_id, fahrzeug_typ, einkaufspreis)')
      .eq('betrieb_id', betriebId)
      .not('einnahmen', 'is', null)
      .gt('einnahmen', 0)
      .order('erstellt_am', { ascending: false }),
    supabase
      .from('rechnungen')
      .select('id, gesamt, datum, bezahlt, lieferant, rechnungsnummer, faellig_am')
      .eq('betrieb_id', betriebId)
      .order('datum', { ascending: false }),
    supabase
      .from('kunden_rechnungen')
      .select('*, kunde:kunden(vorname, nachname, telefon, mobil, email), fahrzeug:fahrzeuge(kennzeichen, marke, modell)')
      .eq('betrieb_id', betriebId)
      .order('erstellt_am', { ascending: false }),
    supabase
      .from('kunden_erinnerungen')
      .select('bezug_id, kanal, erstellt_am')
      .eq('betrieb_id', betriebId)
      .eq('art', 'zahlung')
      .order('erstellt_am', { ascending: true }),
    resolveFirmaSettings(supabase, betriebId),
  ])

  // je Rechnung: wie oft und zuletzt wann/auf welchem Weg erinnert
  const erinnerungen: Record<string, { anzahl: number; letzte: string; kanal: string }> = {}
  for (const e of (erinnerungenRaw ?? []) as any[]) {
    const alt = erinnerungen[e.bezug_id]
    erinnerungen[e.bezug_id] = { anzahl: (alt?.anzahl ?? 0) + 1, letzte: e.erstellt_am, kanal: e.kanal }
  }

  return (
    <BuchhaltungContent
      auftraege={(auftraege ?? []) as any[]}
      ausgaben={(ausgaben ?? []) as any[]}
      kundenRechnungen={(kundenRechnungen ?? []) as any[]}
      kleinunternehmer={cfg.firma_kleinunternehmer === 'ja'}
      firmaName={cfg.firma_name ?? ''}
      erinnerungen={erinnerungen}
      startTab={tab === 'rechnungen' ? 'rechnungen' : undefined}
      startFilter={filter === 'ueberfaellig' || filter === 'offen' ? filter : undefined}
    />
  )
}
