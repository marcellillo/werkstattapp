export interface Kostenvoranschlag {
  id: string
  betrieb_id: string
  typ: 'werkstatt' | 'verkauf'
  nummer: string
  kunde_id?: string
  status: 'entwurf' | 'gesendet' | 'akzeptiert' | 'abgelehnt'
  summe: number
  created_at: string
  updated_at: string
}

export interface KostenvoranschlagPosition {
  id: string
  kostenvoranschlag_id: string
  beschreibung: string
  menge: number
  einheit: string
  preis: number
  summe: number
  position: number
}

export interface Werkstattauftrag {
  id: string
  betrieb_id: string
  fahrzeug_id?: string
  kunde_id?: string
  status: 'neu' | 'in_bearbeitung' | 'fertig' | 'abgerechnet'
  beschreibung: string
  mechatroniker_id?: string
  kostenvoranschlag_id?: string
  created_at: string
  updated_at: string
}

export interface Arbeitszeit {
  id: string
  werkstattauftrag_id: string
  mechatroniker_id?: string
  datum: string
  stunden: number
  stundensatz: number
  summe: number
}

export interface Rechnung {
  id: string
  betrieb_id: string
  typ: 'werkstatt' | 'verkauf'
  nummer: string
  werkstattauftrag_id?: string
  fahrzeug_id?: string
  kunde_id?: string
  status: 'entwurf' | 'gesendet' | 'bezahlt' | 'storniert'
  summe: number
  created_at: string
  updated_at: string
}

export interface RechnungsPosition {
  id: string
  rechnung_id: string
  beschreibung: string
  menge: number
  preis: number
  summe: number
  position: number
}
