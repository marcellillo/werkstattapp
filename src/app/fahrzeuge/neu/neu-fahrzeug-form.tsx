'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Car, User, Plus, Download, Upload, ShieldAlert, Bell, BellOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Kunde, Hebebuehne } from '@/types/database'

interface MobileAd {
  mobileAdId: string
  internalNumber: string
  make: string
  model: string
  modelDescription: string
  vin?: string
  firstRegistration?: string
  mileage?: number
  exteriorColor?: string
  gearbox?: string
  fuel?: string
  cubicCapacity?: number
  power?: number
  price?: { consumerPriceGross?: string; consumerPriceNet?: string }
  images?: { ref: string; hash?: string }[]
}

interface Props {
  kunden: Kunde[]
  hebebuehnen: Hebebuehne[]
}

const COLOR_MAP: Record<string, string> = {
  YELLOW: 'Gelb', BLACK: 'Schwarz', WHITE: 'Weiß', SILVER: 'Silber',
  GREY: 'Grau', GRAY: 'Grau', BLUE: 'Blau', RED: 'Rot', GREEN: 'Grün',
  BROWN: 'Braun', BEIGE: 'Beige', ORANGE: 'Orange', GOLD: 'Gold',
  VIOLET: 'Violett', BRONZE: 'Bronze',
}

const FUEL_MAP: Record<string, string> = {
  DIESEL: 'Diesel', PETROL: 'Benzin', ELECTRIC: 'Elektro',
  HYBRID: 'Hybrid', LPG: 'LPG', CNG: 'CNG', HYDROGEN: 'Wasserstoff',
}

function parseYear(firstReg?: string): string {
  if (!firstReg || firstReg.length < 4) return ''
  return firstReg.slice(0, 4)
}

export function NeuFahrzeugForm({ kunden, hebebuehnen }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Mobile.de Bestand
  const [mobileAds, setMobileAds] = useState<MobileAd[]>([])
  const [selectedBNummer, setSelectedBNummer] = useState('')
  const [bestandDatum, setBestandDatum] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fahrzeug fields
  const [fahrzeugTyp, setFahrzeugTyp] = useState<'eigen' | 'fremd'>('fremd')
  const [marke, setMarke] = useState('')
  const [modell, setModell] = useState('')
  const [kennzeichen, setKennzeichen] = useState('')
  const [fahrgestellnummer, setFahrgestellnummer] = useState('')
  const [baujahr, setBaujahr] = useState('')
  const [kilometerstand, setKilometerstand] = useState('')
  const [farbe, setFarbe] = useState('')
  const [motortyp, setMotortyp] = useState('')
  const [hubraum, setHubraum] = useState('')
  const [leistungKw, setLeistungKw] = useState('')
  const [mobileDeId, setMobileDeId] = useState('')
  const [verkaufspreis, setVerkaufspreis] = useState('')
  const [bilderUrls, setBilderUrls] = useState<string[]>([])

  // Customer
  const [kundenId, setKundenId] = useState('')
  const [newKunde, setNewKunde] = useState(false)
  const [kVorname, setKVorname] = useState('')
  const [kNachname, setKNachname] = useState('')
  const [kFirma, setKFirma] = useState('')
  const [kTelefon, setKTelefon] = useState('')
  const [kMobil, setKMobil] = useState('')

  // TÜV-Wecker
  const [naechsteHu, setNaechsteHu] = useState('')
  const [tuevErinnerung, setTuevErinnerung] = useState<boolean | null>(null)

  // Order
  const [arbeiten, setArbeiten] = useState('')
  const [hebebuehneId, setHebebuehneId] = useState('')
  const [dauerTage, setDauerTage] = useState('')
  const [fertigDatum, setFertigDatum] = useState('')
  const [datumManuell, setDatumManuell] = useState(false)

  // Auto-Berechnung: Fertigstellung = heute + Dauer (Werktage), solange nicht manuell überschrieben
  useEffect(() => {
    if (datumManuell || !dauerTage) return
    const tage = parseFloat(dauerTage)
    if (isNaN(tage) || tage <= 0) return
    const d = new Date()
    let verbleibend = Math.ceil(tage)
    while (verbleibend > 0) {
      d.setDate(d.getDate() + 1)
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) verbleibend-- // Wochenenden überspringen
    }
    setFertigDatum(d.toISOString().split('T')[0])
  }, [dauerTage, datumManuell])

  useEffect(() => {
    loadBestand()
  }, [])

  function loadBestand(data?: any) {
    const source = data
      ? Promise.resolve(data)
      : (() => {
          const cached = localStorage.getItem('mobile_bestand')
          if (cached) {
            try { return Promise.resolve(JSON.parse(cached)) } catch {}
          }
          return fetch('/mobile-bestand.json').then(r => r.json())
        })()

    source.then((d: any) => {
      const ads: MobileAd[] = (d.ads || []).filter((a: MobileAd) => a.internalNumber)
      ads.sort((a, b) => {
        const numA = parseInt(a.internalNumber.replace(/\D/g, '')) || 0
        const numB = parseInt(b.internalNumber.replace(/\D/g, '')) || 0
        return numA - numB
      })
      setMobileAds(ads)
      if (d._importedAt) setBestandDatum(d._importedAt)
    }).catch(() => {})
  }

  function handleBestandUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string
        const parsed = JSON.parse(text)
        const withDate = { ...parsed, _importedAt: new Date().toLocaleDateString('de-DE') }
        localStorage.setItem('mobile_bestand', JSON.stringify(withDate))
        loadBestand(withDate)
      } catch {
        alert('Fehler beim Lesen der Datei. Bitte eine gültige ads.json hochladen.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleMobileSelect(bNummer: string) {
    setSelectedBNummer(bNummer)
    if (!bNummer) return
    const ad = mobileAds.find(a => a.internalNumber === bNummer)
    if (!ad) return

    const makeCap = ad.make.charAt(0) + ad.make.slice(1).toLowerCase()
    setMarke(makeCap)
    setModell(ad.model)
    setFahrgestellnummer(ad.vin || '')
    setBaujahr(parseYear(ad.firstRegistration))
    setKilometerstand(ad.mileage ? String(ad.mileage) : '')
    setFarbe(COLOR_MAP[ad.exteriorColor || ''] || ad.exteriorColor || '')
    setMotortyp(FUEL_MAP[ad.fuel || ''] || ad.fuel || '')
    setHubraum(ad.cubicCapacity ? String(ad.cubicCapacity) : '')
    setLeistungKw(ad.power ? String(ad.power) : '')
    setMobileDeId(ad.internalNumber)
    setKennzeichen(ad.internalNumber)
    setVerkaufspreis(ad.price?.consumerPriceGross || '')
    setBilderUrls((ad.images ?? []).map(img => img.ref))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!marke || !modell || !kennzeichen) {
      setError('Marke, Modell und Kennzeichen sind Pflichtfelder.')
      return
    }
    setSaving(true)
    setError('')

    try {
      let finalKundenId = kundenId || null
      if (newKunde && kNachname) {
        const { data: newK } = await supabase.from('kunden').insert({
          vorname: kVorname,
          nachname: kNachname,
          firma: kFirma || null,
          telefon: kTelefon || null,
          mobil: kMobil || null,
        }).select().single()
        finalKundenId = newK?.id ?? null
      }

      const { data: fahrzeug } = await supabase.from('fahrzeuge').insert({
        kunden_id: finalKundenId,
        fahrzeug_typ: fahrzeugTyp,
        marke,
        modell,
        kennzeichen: kennzeichen.toUpperCase(),
        fahrgestellnummer: fahrgestellnummer || null,
        baujahr: baujahr ? parseInt(baujahr) : null,
        kilometerstand: kilometerstand ? parseInt(kilometerstand) : null,
        farbe: farbe || null,
        motortyp: motortyp || null,
        hubraum: hubraum || null,
        leistung_kw: leistungKw ? parseInt(leistungKw) : null,
        mobile_de_id: mobileDeId || null,
        bilder_urls: bilderUrls.length > 0 ? JSON.stringify(bilderUrls) : null,
        notizen: verkaufspreis ? `Verkaufspreis: ${parseFloat(verkaufspreis).toLocaleString('de-DE')} € (Brutto)` : null,
        naechste_hauptuntersuchung: naechsteHu || null,
      }).select().single()

      // tuev_erinnerung separat – keine harte Abhängigkeit
      if (fahrzeug && tuevErinnerung !== null) {
        await supabase.from('fahrzeuge')
          .update({ tuev_erinnerung: tuevErinnerung })
          .eq('id', fahrzeug.id)
      }

      if (!fahrzeug) throw new Error('Fahrzeug konnte nicht erstellt werden')

      const finSuffix = fahrgestellnummer ? fahrgestellnummer.slice(-6).toUpperCase() : Date.now().toString().slice(-6)
      const auftragNr = `AU-${finSuffix}`
      const { data: auftrag } = await supabase.from('auftraege').insert({
        auftrag_nr: auftragNr,
        fahrzeug_id: fahrzeug.id,
        kunden_id: finalKundenId,
        hebebuehne_id: hebebuehneId || null,
        status: 'angenommen',
        arbeiten: arbeiten || null,
        geschaetzte_dauer_tage: dauerTage ? parseFloat(dauerTage) : null,
        geplante_fertigstellung: fertigDatum || null,
      }).select().single()

      if (auftrag) {
        router.push('/dashboard')
      }
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
      setSaving(false)
    }
  }

  const selectedAd = mobileAds.find(a => a.internalNumber === selectedBNummer)

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/fahrzeuge">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Zurück
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Neues Fahrzeug anlegen</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="w-5 h-5 text-orange-500" />
              Fahrzeugdaten
            </CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">* Pflichtfeld</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Eigen/Fremd toggle */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => setFahrzeugTyp('fremd')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${fahrzeugTyp === 'fremd' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-800 hover:text-gray-700'}`}
              >
                Fremdfahrzeug
              </button>
              <button
                type="button"
                onClick={() => setFahrzeugTyp('eigen')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${fahrzeugTyp === 'eigen' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-800 hover:text-gray-700'}`}
              >
                Eigenfahrzeug
              </button>
            </div>

            {/* Mobile.de Import — nur bei Eigenfahrzeug */}
            {fahrzeugTyp === 'eigen' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">Aus Mobile.de Bestand laden</span>
                  <span className="text-xs text-purple-500 ml-auto">
                    {mobileAds.length > 0 ? `${mobileAds.length} Fahrzeuge${bestandDatum ? ` · ${bestandDatum}` : ''}` : 'Kein Bestand'}
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700"
                    title="ads.json aus Mobile.de Händlerportal hochladen"
                  >
                    <Upload className="w-3 h-3" /> Hochladen
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleBestandUpload}
                    className="hidden"
                  />
                </div>
                {mobileAds.length > 0 && (
                  <>
                    <select
                      value={selectedBNummer}
                      onChange={e => handleMobileSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="">— B-Nummer auswählen —</option>
                      {mobileAds.map(ad => (
                        <option key={ad.mobileAdId} value={ad.internalNumber}>
                          {ad.internalNumber} — {ad.make.charAt(0) + ad.make.slice(1).toLowerCase()} {ad.model}
                          {ad.firstRegistration ? ` (${parseYear(ad.firstRegistration)})` : ''}
                          {ad.price?.consumerPriceGross ? ` · ${parseFloat(ad.price.consumerPriceGross).toLocaleString('de-DE')} €` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedAd && (
                      <p className="text-xs text-purple-600 mt-1.5">
                        Felder automatisch befüllt — Kennzeichen bitte manuell eintragen
                      </p>
                    )}
                  </>
                )}
                {mobileAds.length === 0 && (
                  <p className="text-xs text-purple-600">
                    Lade die <strong>ads.json</strong> aus dem Mobile.de Händlerportal hoch (Mein Konto → Dateiexport → ads.json)
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-800 mb-1 block">Marke *</label>
                <input value={marke} onChange={e => setMarke(e.target.value)} placeholder="z.B. BMW"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs text-gray-800 mb-1 block">Modell *</label>
                <input value={modell} onChange={e => setModell(e.target.value)} placeholder="z.B. 3er"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs text-gray-800 mb-1 block">Kennzeichen *</label>
                <input value={kennzeichen} onChange={e => setKennzeichen(e.target.value.toUpperCase())} placeholder="S-AB 1234"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs text-gray-800 mb-1 block">Baujahr</label>
                <input type="number" value={baujahr} onChange={e => setBaujahr(e.target.value)} placeholder="2020"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs text-gray-800 mb-1 block">Kilometerstand</label>
                <input type="number" value={kilometerstand} onChange={e => setKilometerstand(e.target.value)} placeholder="50000"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs text-gray-800 mb-1 block">Farbe</label>
                <input value={farbe} onChange={e => setFarbe(e.target.value)} placeholder="Schwarz"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-800 mb-1 block">Fahrgestellnummer (VIN)</label>
                <input value={fahrgestellnummer} onChange={e => setFahrgestellnummer(e.target.value.toUpperCase())} placeholder="WBA..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              {fahrzeugTyp === 'eigen' && (
                <>
                  <div>
                    <label className="text-xs text-gray-800 mb-1 block">Kraftstoff</label>
                    <input value={motortyp} onChange={e => setMotortyp(e.target.value)} placeholder="Diesel"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-800 mb-1 block">Leistung (kW)</label>
                    <input type="number" value={leistungKw} onChange={e => setLeistungKw(e.target.value)} placeholder="110"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-800 mb-1 block">Hubraum (ccm)</label>
                    <input type="number" value={hubraum} onChange={e => setHubraum(e.target.value)} placeholder="1968"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-800 mb-1 block">Verkaufspreis (€ Brutto)</label>
                    <input type="number" value={verkaufspreis} onChange={e => setVerkaufspreis(e.target.value)} placeholder="15990"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer — only for Fremdfahrzeuge */}
        {fahrzeugTyp !== 'eigen' && <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-5 h-5 text-blue-500" />
                Kunde
              </CardTitle>
              <button
                type="button"
                onClick={() => setNewKunde(v => !v)}
                className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {newKunde ? 'Bestehenden wählen' : 'Neuen anlegen'}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {newKunde ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-800 mb-1 block">Vorname</label>
                  <input value={kVorname} onChange={e => setKVorname(e.target.value)} placeholder="Max"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-800 mb-1 block">Nachname *</label>
                  <input value={kNachname} onChange={e => setKNachname(e.target.value)} placeholder="Mustermann"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-800 mb-1 block">Firma</label>
                  <input value={kFirma} onChange={e => setKFirma(e.target.value)} placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-800 mb-1 block">Telefon</label>
                  <input value={kTelefon} onChange={e => setKTelefon(e.target.value)} placeholder="0711 123456"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-800 mb-1 block">Mobil</label>
                  <input value={kMobil} onChange={e => setKMobil(e.target.value)} placeholder="0171 9876543"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>
            ) : (
              <select
                value={kundenId}
                onChange={e => setKundenId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">— Kein Kunde —</option>
                {kunden.map(k => (
                  <option key={k.id} value={k.id}>
                    {k.vorname} {k.nachname}{k.firma ? ` (${k.firma})` : ''}
                  </option>
                ))}
              </select>
            )}
          </CardContent>
        </Card>}

        {/* TÜV-Wecker — nur bei Fremdfahrzeugen */}
        {fahrzeugTyp === 'fremd' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="w-5 h-5 text-yellow-500" />
                TÜV-Wecker
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-gray-800 mb-1 block">Nächste Hauptuntersuchung (HU)</label>
                <input
                  type="date"
                  value={naechsteHu}
                  onChange={e => setNaechsteHu(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                {naechsteHu && (() => {
                  const days = Math.ceil((new Date(naechsteHu + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000)
                  const color = days < 0 ? 'text-red-600' : days <= 30 ? 'text-orange-600' : days <= 60 ? 'text-yellow-600' : 'text-green-600'
                  const label = days < 0 ? `${Math.abs(days)} Tage überfällig` : days === 0 ? 'Heute!' : `in ${days} Tagen`
                  return <p className={`text-xs mt-1 font-medium ${color}`}>HU: {label}</p>
                })()}
              </div>

              {naechsteHu && (
                <div>
                  <p className="text-xs text-gray-700 font-medium mb-2">
                    Möchte der Kunde an den TÜV erinnert werden?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTuevErinnerung(true)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        tuevErinnerung === true
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-600'
                      }`}
                    >
                      <Bell className="w-4 h-4" /> Ja, bitte erinnern
                    </button>
                    <button
                      type="button"
                      onClick={() => setTuevErinnerung(false)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        tuevErinnerung === false
                          ? 'bg-gray-400 border-gray-400 text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <BellOff className="w-4 h-4" /> Nein, danke
                    </button>
                  </div>
                  {tuevErinnerung === true && (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Fahrzeug erscheint im TÜV-Wecker und kann rechtzeitig kontaktiert werden.
                    </p>
                  )}
                  {tuevErinnerung === false && (
                    <p className="text-xs text-gray-400 mt-2">Kunde wird im TÜV-Wecker nicht angezeigt.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Work order */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Auftrag</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-gray-800 mb-2 block">Leistungen auswählen</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  'Ölwechsel', 'Reifenwechsel', 'Klimaservice', 'Inspektionen',
                  'HU/AU-Vorbereitung', 'Reparatur & Diagnose', 'Autoglas',
                  'Achsvermessung/-einstellung', 'ADAS-Kalibrierung',
                  'Fahrzeugaufbereitung', 'Politur', 'Sonstige Leistungen',
                ].map(leistung => {
                  const active = arbeiten.includes(leistung)
                  return (
                    <button
                      key={leistung}
                      type="button"
                      onClick={() => {
                        setArbeiten(prev => {
                          const lines = prev ? prev.split('\n').filter(Boolean) : []
                          if (lines.includes(leistung)) {
                            return lines.filter(l => l !== leistung).join('\n')
                          }
                          return [...lines, leistung].join('\n')
                        })
                      }}
                      className={`px-4 py-3 rounded-xl text-sm font-medium border transition-colors min-h-[44px] ${
                        active
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:text-orange-600'
                      }`}
                    >
                      {leistung}
                    </button>
                  )
                })}
              </div>
              <label className="text-xs text-gray-800 mb-1 block">Zusätzliche Hinweise</label>
              <textarea
                value={arbeiten.split('\n').filter(l =>
                  !['Ölwechsel','Reifenwechsel','Klimaservice','Inspektionen',
                    'HU/AU-Vorbereitung','Reparatur & Diagnose','Autoglas',
                    'Achsvermessung/-einstellung','ADAS-Kalibrierung',
                    'Fahrzeugaufbereitung','Politur','Sonstige Leistungen'].includes(l)
                ).join('\n')}
                onChange={e => {
                  const selected = arbeiten.split('\n').filter(l =>
                    ['Ölwechsel','Reifenwechsel','Klimaservice','Inspektionen',
                      'HU/AU-Vorbereitung','Reparatur & Diagnose','Autoglas',
                      'Achsvermessung/-einstellung','ADAS-Kalibrierung',
                      'Fahrzeugaufbereitung','Politur','Sonstige Leistungen'].includes(l)
                  )
                  const extra = e.target.value
                  setArbeiten([...selected, ...(extra ? [extra] : [])].join('\n'))
                }}
                placeholder="z.B. Ölwechsel + Filter, Bremsbeläge vorne erneuern, Reifenwechsel auf Winterreifen..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            {/* Geschätzte Dauer */}
            <div>
              <label className="text-xs text-gray-800 mb-1.5 block">Geschätzte Dauer der Arbeiten</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  { label: '½ Tag', value: '0.5' },
                  { label: '1 Tag', value: '1' },
                  { label: '2 Tage', value: '2' },
                  { label: '3 Tage', value: '3' },
                  { label: '1 Woche', value: '5' },
                  { label: '2 Wochen', value: '10' },
                ].map(opt => {
                  const active = dauerTage === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setDauerTage(opt.value); setDatumManuell(false) }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:text-orange-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={dauerTage}
                  onChange={e => { setDauerTage(e.target.value); setDatumManuell(false) }}
                  placeholder="… eigene"
                  className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              {dauerTage && !datumManuell && fertigDatum && (
                <p className="text-xs text-orange-600">
                  Vorschlag: fertig am <strong>{new Date(fertigDatum + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</strong> (Wochenenden ausgenommen)
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-800 mb-1 block">Hebebühne</label>
                <select
                  value={hebebuehneId}
                  onChange={e => setHebebuehneId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">— Keine —</option>
                  {hebebuehnen.map(h => (
                    <option key={h.id} value={h.id}>{h.bezeichnung}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-800 mb-1 block">
                  Geplante Fertigstellung
                  {dauerTage && !datumManuell && <span className="text-orange-500 font-normal"> · automatisch</span>}
                </label>
                <input
                  type="date"
                  value={fertigDatum}
                  onChange={e => { setFertigDatum(e.target.value); setDatumManuell(true) }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={saving}
            className="bg-orange-600 hover:bg-orange-700 text-white flex-1"
          >
            {saving ? 'Anlegen...' : 'Auftrag anlegen'}
          </Button>
          <Link href="/fahrzeuge">
            <Button type="button" variant="ghost">Abbrechen</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
