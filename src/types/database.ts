// ============================================================
// Kfz-Werkstatt – Typen
// ============================================================

export type WerkstattUserRole = 'admin' | 'werkstattmeister' | 'mechaniker'

export type FahrzeugTyp = 'eigen' | 'fremd'
export type TerminTyp = 'werkstatt' | 'tuev' | 'online'
export type TerminStatus = 'offen' | 'bestaetigt' | 'erledigt' | 'abgesagt'
export type TuevErgebnis = 'bestanden' | 'nicht_bestanden' | 'maengel'

export type FahrzeugStatus =
  | 'angenommen'
  | 'diagnose'
  | 'reparatur'
  | 'warten_teile'
  | 'fertig'
  | 'ausgeliefert'
  | 'storniert'

export type TeilStatus =
  | 'nicht_bestellt'
  | 'bestellt'
  | 'unterwegs'
  | 'geliefert'
  | 'eingebaut'

export type BenachrichtigungTyp =
  | 'info'
  | 'warnung'
  | 'fehler'
  | 'teil_eingetroffen'
  | 'termin_ueberschritten'
  | 'zu_lange_auf_buehne'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: WerkstattUserRole
  phone?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Kunde {
  id: string
  vorname: string
  nachname: string
  firma?: string
  email?: string
  telefon?: string
  mobil?: string
  strasse?: string
  plz?: string
  ort?: string
  notizen?: string
  created_at: string
  updated_at: string
}

export interface Hebebuehne {
  id: string
  nummer: number
  bezeichnung: string
  beschreibung?: string
  erstellt_am: string
}

export interface Fahrzeug {
  id: string
  kunden_id?: string
  fahrzeug_typ: FahrzeugTyp
  marke: string
  modell: string
  kennzeichen: string
  fahrgestellnummer?: string
  baujahr?: number
  kilometerstand?: number
  farbe?: string
  motortyp?: string
  hubraum?: string
  leistung_kw?: number
  naechste_hauptuntersuchung?: string
  notizen?: string
  mobile_de_id?: string
  erstellt_am: string
  aktualisiert_am: string
  kunde?: Kunde
}

export interface Termin {
  id: string
  titel: string
  beschreibung?: string
  datum: string
  uhrzeit?: string
  dauer_minuten: number
  typ: TerminTyp
  status: TerminStatus
  kunden_id?: string
  fahrzeug_id?: string
  auftrag_id?: string
  notizen?: string
  quelle: string
  extern_id?: string
  erstellt_am: string
  aktualisiert_am: string
  kunde?: Kunde
  fahrzeug?: Fahrzeug
}

export interface Auftrag {
  id: string
  auftrag_nr: string
  fahrzeug_id: string
  kunden_id?: string
  hebebuehne_id?: string
  status: FahrzeugStatus
  arbeiten?: string
  bemerkungen?: string
  zugewiesen_an?: string
  geplante_fertigstellung?: string
  fertiggestellt_am?: string
  einnahmen?: number
  tuev_kandidat?: boolean
  tuev_termin?: string
  tuev_ergebnis?: TuevErgebnis
  erstellt_am: string
  aktualisiert_am: string
  fahrzeug?: Fahrzeug
  kunde?: Kunde
  hebebuehne?: Hebebuehne
  ersatzteile?: Ersatzteil[]
  zugewiesener_mitarbeiter?: Profile
}

export interface Ersatzteil {
  id: string
  auftrag_id: string
  bezeichnung: string
  teilenummer?: string
  lieferant?: string
  menge: number
  einzelpreis?: number
  status: TeilStatus
  bestellt_am?: string
  geliefert_am?: string
  notizen?: string
  erstellt_am: string
  aktualisiert_am: string
}

export interface StatusHistorie {
  id: string
  auftrag_id: string
  status_alt?: string
  status_neu: string
  geaendert_von?: string
  bemerkung?: string
  erstellt_am: string
  mitarbeiter?: Profile
}

export interface EmailProtokoll {
  id: string
  auftrag_id?: string
  ersatzteil_id?: string
  absender?: string
  betreff?: string
  inhalt?: string
  empfangen_am: string
  erkannter_status?: string
  verarbeitet: boolean
}

export interface Benachrichtigung {
  id: string
  benutzer_id?: string
  titel: string
  nachricht: string
  typ: BenachrichtigungTyp
  auftrag_id?: string
  gelesen: boolean
  erstellt_am: string
}

// ============================================================
// Label / Color helpers
// ============================================================

export const FAHRZEUG_STATUS_LABEL: Record<FahrzeugStatus, string> = {
  angenommen: 'Angenommen',
  diagnose: 'Diagnose läuft',
  reparatur: 'Reparatur läuft',
  warten_teile: 'Warten auf Teile',
  fertig: 'Fertig',
  ausgeliefert: 'Ausgeliefert',
  storniert: 'Storniert',
}

export const FAHRZEUG_STATUS_COLOR: Record<FahrzeugStatus, string> = {
  angenommen: 'bg-gray-100 text-gray-700 border-gray-300',
  diagnose: 'bg-blue-100 text-blue-700 border-blue-300',
  reparatur: 'bg-orange-100 text-orange-700 border-orange-300',
  warten_teile: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  fertig: 'bg-green-100 text-green-700 border-green-300',
  ausgeliefert: 'bg-purple-100 text-purple-700 border-purple-300',
  storniert: 'bg-red-100 text-red-700 border-red-300',
}

export const TEIL_STATUS_LABEL: Record<TeilStatus, string> = {
  nicht_bestellt: 'Nicht bestellt',
  bestellt: 'Bestellt',
  unterwegs: 'Unterwegs',
  geliefert: 'Geliefert',
  eingebaut: 'Eingebaut',
}

export const TEIL_STATUS_COLOR: Record<TeilStatus, string> = {
  nicht_bestellt: 'bg-red-100 text-red-700 border-red-300',
  bestellt: 'bg-orange-100 text-orange-700 border-orange-300',
  unterwegs: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  geliefert: 'bg-green-100 text-green-700 border-green-300',
  eingebaut: 'bg-emerald-100 text-emerald-700 border-emerald-300',
}
