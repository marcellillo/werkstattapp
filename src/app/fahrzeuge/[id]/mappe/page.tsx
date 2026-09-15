import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AuftragsMappe } from './auftrags-mappe'
import { getBetriebIdForUser } from '@/lib/server-betrieb'
import { resolveFirmaSettings } from '@/lib/firma-settings'
import { resolveRechnungDetail } from '@/lib/rechnung-detail'

export default async function MappePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const betriebId = await getBetriebIdForUser(supabase, user.id)

  const { data: auftrag } = await supabase
    .from('auftraege')
    .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)')
    .eq('betrieb_id', betriebId)
    .eq('id', id)
    .single()

  if (!auftrag) notFound()

  const [{ data: fotos }, { data: rechnungenRows }, cfg, { data: dokumente }, { data: lieferantenRechnungen }] = await Promise.all([
    supabase.from('auftrag_fotos').select('*').eq('auftrag_id', id).order('erstellt_am'),
    supabase.from('kunden_rechnungen').select('*').eq('auftrag_id', id).order('erstellt_am'),
    resolveFirmaSettings(supabase, betriebId),
    supabase.from('lieferschein_uploads').select('*').eq('auftrag_id', id).order('erstellt_am'),
    auftrag.fahrzeug_id
      ? supabase.from('supplier_invoices').select('*').eq('fahrzeug_id', auftrag.fahrzeug_id).order('erstellt_am')
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Jede Rechnung eines Auftrags separat um ihre Positionen (Ersatzteile/Arbeitszeiten)
  // ergänzen, damit die Mappe nicht nur die Summe, sondern alle Rechnungsdetails zeigt.
  const rechnungen = await Promise.all(
    (rechnungenRows ?? []).map(async (r) => {
      const detail = await resolveRechnungDetail(supabase, r.id, betriebId)
      return {
        ...r,
        ersatzteilePositionen: detail?.ersatzteilePositionen ?? [],
        arbeitswertePositionen: detail?.arbeitswertePositionen ?? [],
        kleinteilNetto: detail?.kleinteilNetto ?? 0,
        sonstigesNetto: detail?.sonstigesNetto ?? 0,
        sonstigesBeschreibung: detail?.sonstigesBeschreibung ?? null,
      }
    })
  )

  return (
    <AuftragsMappe
      auftrag={auftrag as any}
      fotos={(fotos ?? []) as any[]}
      rechnungen={rechnungen as any[]}
      firma={cfg}
      betriebId={betriebId}
      dokumente={(dokumente ?? []) as any[]}
      lieferantenRechnungen={(lieferantenRechnungen ?? []) as any[]}
    />
  )
}
