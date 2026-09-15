'use client'
import { useState } from 'react'
import { AlertCircle, CheckCircle2, Download, Printer, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface FahrzeugFelder {
  marke: string
  modell: string
  kennzeichen: string
  fahrgestellnummer: string
  baujahr: string
  kilometerstand: string
  farbe: string
  motortyp: string
  hubraum: string
  leistung_kw: string
  naechste_hauptuntersuchung: string
}

interface KundeFelder {
  vorname: string
  nachname: string
  telefon: string
  email: string
  strasse: string
  plz: string
  ort: string
}

interface AuftragFelder {
  arbeiten: string
  einnahmen: string
}

interface Props {
  auftrag: any
  onWeiter: (updated: any) => void
}

function Pflichtfeld({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  const leer = !value || value.trim() === ''
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {leer
          ? <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
          : <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
        }
        <label className="text-sm font-medium text-gray-700">{label}</label>
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || `${label} eingeben...`}
        className={cn(
          'w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors',
          leer ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'
        )}
      />
    </div>
  )
}

export function FelderPruefen({ auftrag, onWeiter }: Props) {
  const fz = auftrag.fahrzeug ?? {}
  const kd = auftrag.kunde ?? {}
  const supabase = createClient()

  const [fzFelder, setFzFelder] = useState<FahrzeugFelder>({
    marke: fz.marke ?? '',
    modell: fz.modell ?? '',
    kennzeichen: fz.kennzeichen ?? '',
    fahrgestellnummer: fz.fahrgestellnummer ?? '',
    baujahr: fz.baujahr?.toString() ?? '',
    kilometerstand: fz.kilometerstand?.toString() ?? '',
    farbe: fz.farbe ?? '',
    motortyp: fz.motortyp ?? '',
    hubraum: fz.hubraum ?? '',
    leistung_kw: fz.leistung_kw?.toString() ?? '',
    naechste_hauptuntersuchung: fz.naechste_hauptuntersuchung ?? '',
  })

  const [kdFelder, setKdFelder] = useState<KundeFelder>({
    vorname: kd.vorname ?? '',
    nachname: kd.nachname ?? '',
    telefon: kd.telefon ?? kd.mobil ?? '',
    email: kd.email ?? '',
    strasse: kd.strasse ?? '',
    plz: kd.plz ?? '',
    ort: kd.ort ?? '',
  })

  const [auftragFelder, setAuftragFelder] = useState<AuftragFelder>({
    arbeiten: auftrag.arbeiten ?? '',
    einnahmen: auftrag.einnahmen?.toString() ?? '',
  })

  const [mobileLaden, setMobileLaden] = useState(false)
  const [mobileFehler, setMobileFehler] = useState('')
  const [speichern, setSpeichern] = useState(false)
  const [tab, setTab] = useState<'fahrzeug' | 'kunde' | 'auftrag'>('fahrzeug')

  const leereFzFelder = Object.entries(fzFelder).filter(([k, v]) =>
    !v && !['hubraum', 'motortyp', 'leistung_kw'].includes(k)
  ).length
  const leereKdFelder = kd.id ? Object.entries(kdFelder).filter(([, v]) => !v).length : 0
  const leereAuftragFelder = Object.entries(auftragFelder).filter(([, v]) => !v).length

  async function vonMobileDeLaden() {
    const mobileId = fz.mobile_de_id
    if (!mobileId) return
    setMobileLaden(true)
    setMobileFehler('')
    try {
      const r = await fetch(`/api/mobile-de?id=${mobileId}`)
      const d = await r.json()
      if (d.error) { setMobileFehler(d.error); return }
      setFzFelder(f => ({
        ...f,
        baujahr: d.baujahr?.toString() ?? f.baujahr,
        kilometerstand: d.km?.toString() ?? f.kilometerstand,
        farbe: d.farbe ?? f.farbe,
        motortyp: d.kraftstoff ?? f.motortyp,
        leistung_kw: d.leistung_kw?.toString() ?? f.leistung_kw,
        hubraum: d.hubraum ?? f.hubraum,
      }))
    } catch (e: any) {
      setMobileFehler('Verbindung zu mobile.de fehlgeschlagen')
    } finally {
      setMobileLaden(false)
    }
  }

  async function weiterZumProtokoll() {
    setSpeichern(true)
    try {
      // Fahrzeugdaten speichern
      if (fz.id) {
        await supabase.from('fahrzeuge').update({
          marke: fzFelder.marke,
          modell: fzFelder.modell,
          kennzeichen: fzFelder.kennzeichen,
          fahrgestellnummer: fzFelder.fahrgestellnummer || null,
          baujahr: fzFelder.baujahr ? parseInt(fzFelder.baujahr) : null,
          kilometerstand: fzFelder.kilometerstand ? parseInt(fzFelder.kilometerstand) : null,
          farbe: fzFelder.farbe || null,
          motortyp: fzFelder.motortyp || null,
          hubraum: fzFelder.hubraum || null,
          leistung_kw: fzFelder.leistung_kw ? parseInt(fzFelder.leistung_kw) : null,
          naechste_hauptuntersuchung: fzFelder.naechste_hauptuntersuchung || null,
        }).eq('id', fz.id)
      }

      // Kundendaten speichern
      if (kd.id) {
        await supabase.from('kunden').update({
          vorname: kdFelder.vorname,
          nachname: kdFelder.nachname,
          telefon: kdFelder.telefon || null,
          email: kdFelder.email || null,
          strasse: kdFelder.strasse || null,
          plz: kdFelder.plz || null,
          ort: kdFelder.ort || null,
        }).eq('id', kd.id)
      }

      // Auftragsdaten speichern
      await supabase.from('auftraege').update({
        arbeiten: auftragFelder.arbeiten || null,
        einnahmen: auftragFelder.einnahmen ? parseFloat(auftragFelder.einnahmen) : null,
      }).eq('id', auftrag.id)

      // Aktualisierte Daten zusammenbauen und weitergeben
      onWeiter({
        ...auftrag,
        arbeiten: auftragFelder.arbeiten,
        einnahmen: auftragFelder.einnahmen ? parseFloat(auftragFelder.einnahmen) : null,
        fahrzeug: {
          ...fz,
          marke: fzFelder.marke,
          modell: fzFelder.modell,
          kennzeichen: fzFelder.kennzeichen,
          fahrgestellnummer: fzFelder.fahrgestellnummer,
          baujahr: fzFelder.baujahr ? parseInt(fzFelder.baujahr) : null,
          kilometerstand: fzFelder.kilometerstand ? parseInt(fzFelder.kilometerstand) : null,
          farbe: fzFelder.farbe,
          motortyp: fzFelder.motortyp,
          hubraum: fzFelder.hubraum,
          leistung_kw: fzFelder.leistung_kw ? parseInt(fzFelder.leistung_kw) : null,
          naechste_hauptuntersuchung: fzFelder.naechste_hauptuntersuchung,
        },
        kunde: kd.id ? {
          ...kd,
          vorname: kdFelder.vorname,
          nachname: kdFelder.nachname,
          telefon: kdFelder.telefon,
          email: kdFelder.email,
          strasse: kdFelder.strasse,
          plz: kdFelder.plz,
          ort: kdFelder.ort,
        } : kd,
      })
    } finally {
      setSpeichern(false)
    }
  }

  const gesamtLeer = leereFzFelder + leereKdFelder + leereAuftragFelder

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sticky top-0 z-10 topbar-safe">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Protokoll vorbereiten</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {fzFelder.marke} {fzFelder.modell} · {fzFelder.kennzeichen || '—'}
              </p>
            </div>
            {gesamtLeer > 0 && (
              <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full">
                {gesamtLeer} leer
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 bg-gray-100 rounded-lg p-1">
            {([
              { key: 'fahrzeug', label: 'Fahrzeug', leer: leereFzFelder },
              { key: 'kunde',    label: 'Kunde',    leer: leereKdFelder },
              { key: 'auftrag',  label: 'Auftrag',  leer: leereAuftragFelder },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex-1 py-2 text-xs font-semibold rounded-md transition-all relative',
                  tab === t.key ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600'
                )}
              >
                {t.label}
                {t.leer > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                    {t.leer}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* mobile.de Import */}
        {tab === 'fahrzeug' && fz.mobile_de_id && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">mobile.de-Inserat erkannt</p>
            <p className="text-xs text-blue-600 mb-3">ID: {fz.mobile_de_id} — Fahrzeugdaten automatisch laden?</p>
            {mobileFehler && <p className="text-xs text-red-600 mb-2">{mobileFehler}</p>}
            <button
              onClick={vonMobileDeLaden}
              disabled={mobileLaden}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg w-full justify-center transition-colors"
            >
              <Download className="w-4 h-4" />
              {mobileLaden ? 'Lade Daten...' : 'Daten von mobile.de laden'}
            </button>
          </div>
        )}

        {/* Fahrzeug-Tab */}
        {tab === 'fahrzeug' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <Pflichtfeld label="Marke"            value={fzFelder.marke}            onChange={v => setFzFelder(f => ({...f, marke: v}))} />
            <Pflichtfeld label="Modell"           value={fzFelder.modell}           onChange={v => setFzFelder(f => ({...f, modell: v}))} />
            <Pflichtfeld label="Kennzeichen"      value={fzFelder.kennzeichen}      onChange={v => setFzFelder(f => ({...f, kennzeichen: v}))} placeholder="z.B. BO-KW 1234" />
            <Pflichtfeld label="Fahrgestellnr."   value={fzFelder.fahrgestellnummer} onChange={v => setFzFelder(f => ({...f, fahrgestellnummer: v}))} placeholder="VIN / FIN" />
            <div className="grid grid-cols-2 gap-3">
              <Pflichtfeld label="Baujahr"        value={fzFelder.baujahr}          onChange={v => setFzFelder(f => ({...f, baujahr: v}))} type="number" placeholder="z.B. 2019" />
              <Pflichtfeld label="Kilometerstand" value={fzFelder.kilometerstand}   onChange={v => setFzFelder(f => ({...f, kilometerstand: v}))} type="number" placeholder="km" />
            </div>
            <Pflichtfeld label="Farbe"            value={fzFelder.farbe}            onChange={v => setFzFelder(f => ({...f, farbe: v}))} placeholder="z.B. Schwarz Metallic" />
            <div className="grid grid-cols-2 gap-3">
              <Pflichtfeld label="Motortyp"       value={fzFelder.motortyp}         onChange={v => setFzFelder(f => ({...f, motortyp: v}))} placeholder="z.B. Diesel" />
              <Pflichtfeld label="Hubraum (ccm)"  value={fzFelder.hubraum}          onChange={v => setFzFelder(f => ({...f, hubraum: v}))} placeholder="z.B. 1968" />
            </div>
            <Pflichtfeld label="Nächste HU"       value={fzFelder.naechste_hauptuntersuchung} onChange={v => setFzFelder(f => ({...f, naechste_hauptuntersuchung: v}))} type="date" />
          </div>
        )}

        {/* Kunde-Tab */}
        {tab === 'kunde' && (
          kd.id ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Pflichtfeld label="Vorname"  value={kdFelder.vorname}  onChange={v => setKdFelder(k => ({...k, vorname: v}))} />
                <Pflichtfeld label="Nachname" value={kdFelder.nachname} onChange={v => setKdFelder(k => ({...k, nachname: v}))} />
              </div>
              <Pflichtfeld label="Telefon" value={kdFelder.telefon} onChange={v => setKdFelder(k => ({...k, telefon: v}))} type="tel" />
              <Pflichtfeld label="E-Mail"  value={kdFelder.email}   onChange={v => setKdFelder(k => ({...k, email: v}))}   type="email" />
              <Pflichtfeld label="Straße"  value={kdFelder.strasse} onChange={v => setKdFelder(k => ({...k, strasse: v}))} />
              <div className="grid grid-cols-2 gap-3">
                <Pflichtfeld label="PLZ"  value={kdFelder.plz} onChange={v => setKdFelder(k => ({...k, plz: v}))} />
                <Pflichtfeld label="Ort"  value={kdFelder.ort} onChange={v => setKdFelder(k => ({...k, ort: v}))} />
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <p className="text-sm text-gray-500">Kein Kunde zugeordnet</p>
              <p className="text-xs text-gray-400 mt-1">Im Auftrag einen Kunden verknüpfen</p>
            </div>
          )
        )}

        {/* Auftrag-Tab */}
        {tab === 'auftrag' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {!auftragFelder.arbeiten
                  ? <AlertCircle className="w-4 h-4 text-orange-500" />
                  : <CheckCircle2 className="w-4 h-4 text-green-500" />
                }
                <label className="text-sm font-medium text-gray-700">Durchgeführte Arbeiten</label>
              </div>
              <textarea
                value={auftragFelder.arbeiten}
                onChange={e => setAuftragFelder(a => ({...a, arbeiten: e.target.value}))}
                placeholder="Beschreibe die durchgeführten Arbeiten..."
                rows={5}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none',
                  !auftragFelder.arbeiten ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                )}
              />
            </div>
            <Pflichtfeld
              label="Gesamtbetrag (€)"
              value={auftragFelder.einnahmen}
              onChange={v => setAuftragFelder(a => ({...a, einnahmen: v}))}
              type="number"
              placeholder="z.B. 450.00"
            />
          </div>
        )}
      </div>

      {/* Weiter-Button — sticky am unteren Rand */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          {gesamtLeer > 0 && (
            <p className="text-xs text-center text-orange-600 mb-3">
              ⚠ Noch {gesamtLeer} Felder leer — trotzdem drucken?
            </p>
          )}
          <button
            onClick={weiterZumProtokoll}
            disabled={speichern}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold py-4 rounded-xl text-base transition-colors"
          >
            <Printer className="w-5 h-5" />
            {speichern ? 'Speichert...' : 'Speichern & Protokoll drucken'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
