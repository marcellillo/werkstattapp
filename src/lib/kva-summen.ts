// Summen eines Kostenvoranschlags für die Kunden-Freigabe: Teile (Kostenvoranschlag) + Arbeitszeit (offene
// Werkstattaufträge desselben Auftrags). Rechnet wie die Rechnungserstellung (Festpreis oder Einzelpositionen,
// 19 % MwSt. außer bei Kleinunternehmern, auf Cent gerundet).
import type { SupabaseClient } from '@supabase/supabase-js'

export interface KvaPosition { beschreibung: string; menge: number; einzelpreis: number; gesamtpreis: number }
export interface KvaSummen {
  teile: KvaPosition[]
  teilePauschal: number | null     // gesetzt, wenn der Kostenvoranschlag auf Festpreis steht
  arbeit: KvaPosition[]
  netto: number
  mwst: number
  brutto: number
  kleinunternehmer: boolean
}

const auf2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const zahl = (v: unknown) => { const n = parseFloat(String(v ?? 0)); return Number.isFinite(n) ? n : 0 }
const alsPos = (p: any): KvaPosition => ({
  beschreibung: String(p.beschreibung ?? ''), menge: zahl(p.menge), einzelpreis: zahl(p.einzelpreis),
  gesamtpreis: zahl(p.gesamtpreis) || auf2(zahl(p.menge) * zahl(p.einzelpreis)),
})

export async function ladeKvaSummen(db: SupabaseClient, kva: { id: string; betrieb_id: string; auftrag_id: string | null; ersatzteile_modus: string | null; ersatzteile_festpreis: number | null }): Promise<KvaSummen> {
  const { data: tp } = await db.from('kostenvoranschlag_position').select('beschreibung, menge, einzelpreis, gesamtpreis').eq('kostenvoranschlag_id', kva.id).order('created_at')
  const festpreis = kva.ersatzteile_modus === 'festpreis'
  const teile = festpreis ? [] : (tp ?? []).map(alsPos)
  const teilePauschal = festpreis ? zahl(kva.ersatzteile_festpreis) : null

  let arbeit: KvaPosition[] = []
  if (kva.auftrag_id) {
    const { data: was } = await db.from('werkstattauftraege').select('id').eq('betrieb_id', kva.betrieb_id).eq('auftrag_id', kva.auftrag_id).is('rechnung_id', null)
    const waIds = (was ?? []).map(w => w.id)
    if (waIds.length) {
      const { data: ap } = await db.from('werkstattauftrag_positionen').select('beschreibung, menge, einzelpreis, gesamtpreis').in('werkstattauftrag_id', waIds).order('created_at')
      arbeit = (ap ?? []).map(alsPos)
    }
  }

  const { data: cfg } = await db.from('betrieb_einstellungen').select('wert').eq('betrieb_id', kva.betrieb_id).eq('schluessel', 'firma_kleinunternehmer').maybeSingle()
  const kleinunternehmer = cfg?.wert === 'ja'

  const netto = auf2((teilePauschal ?? teile.reduce((s, p) => s + p.gesamtpreis, 0)) + arbeit.reduce((s, p) => s + p.gesamtpreis, 0))
  const mwst = kleinunternehmer ? 0 : auf2(netto * 0.19)
  return { teile, teilePauschal, arbeit, netto, mwst, brutto: auf2(netto + mwst), kleinunternehmer }
}
