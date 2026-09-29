'use client'
import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { createClient } from '@/lib/supabase/client'
import { geocodeAdresse, geocodeSequenziell } from '@/lib/geocode'
import type { Kunde } from '@/types/database'
import { Loader2 } from 'lucide-react'

interface Props {
  kunden: Kunde[]
  firma: Record<string, string>
}

// Fallback-Mittelpunkt, falls die Werkstatt-Adresse (noch) nicht geokodiert
// werden konnte -- Helmstedt/Region Braunschweig, wo Helios Automobile sitzt.
const FALLBACK_ZENTRUM: [number, number] = [52.23, 11.01]

export function KundenKarte({ kunden: initialKunden, firma }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerGroupRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const [kunden, setKunden] = useState(initialKunden)
  const [werkstattPos, setWerkstattPos] = useState<[number, number] | null>(null)
  const [geocodiereAnzahl, setGeocodiereAnzahl] = useState(0)
  const [mapBereit, setMapBereit] = useState(false)
  const supabase = createClient()

  // Karte einmalig initialisieren
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapDivRef.current || mapRef.current) return
      leafletRef.current = L

      // Leaflets Standard-Icon-Pfade werden von Next.js' Bundler nicht automatisch
      // aufgelöst -- Icons stattdessen über CDN laden.
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapDivRef.current).setView(FALLBACK_ZENTRUM, 10)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>-Mitwirkende',
        maxZoom: 19,
      }).addTo(map)

      markerGroupRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      // Erst jetzt ist die Karte tatsächlich bereit -- die Marker-Zeichnen-Effekte
      // (die z.B. beim Mount VOR diesem async Import bereits gelaufen sein können,
      // ohne etwas zu zeichnen) müssen dadurch erneut anlaufen, sonst bleibt die
      // Karte leer, wenn sich kunden/werkstattPos danach nicht mehr ändern.
      setMapBereit(true)
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Werkstatt-Standort ("Wo bin ich") geokodieren
  useEffect(() => {
    if (!firma.firma_strasse && !firma.firma_ort) return
    geocodeAdresse(firma.firma_strasse, firma.firma_plz, firma.firma_ort).then(pos => {
      if (pos) setWerkstattPos([pos.lat, pos.lng])
    })
  }, [firma.firma_strasse, firma.firma_plz, firma.firma_ort])

  // Kunden ohne gespeicherte Koordinaten nachträglich geokodieren und persistieren
  useEffect(() => {
    const fehlend = kunden.filter(k => k.lat == null && k.lng == null && (k.strasse || k.ort))
    if (fehlend.length === 0) return
    setGeocodiereAnzahl(fehlend.length)
    geocodeSequenziell(
      fehlend,
      k => ({ strasse: k.strasse, plz: k.plz, ort: k.ort }),
      async (kunde, pos) => {
        setGeocodiereAnzahl(n => Math.max(0, n - 1))
        if (!pos) return
        setKunden(prev => prev.map(k => k.id === kunde.id ? { ...k, lat: pos.lat, lng: pos.lng } : k))
        await supabase.from('kunden').update({ lat: pos.lat, lng: pos.lng }).eq('id', kunde.id)
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Marker neu zeichnen, wenn sich Kunden-Koordinaten oder Werkstatt-Standort ändern
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const group = markerGroupRef.current
    if (!L || !map || !group) return

    group.clearLayers()
    const punkte: [number, number][] = []

    if (werkstattPos) {
      const werkstattIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      })
      L.marker(werkstattPos, { icon: werkstattIcon })
        .bindPopup(`<strong>📍 Wo bin ich</strong><br>${firma.firma_name || 'Werkstatt'}${firma.firma_strasse ? `<br>${firma.firma_strasse}` : ''}`)
        .addTo(group)
      punkte.push(werkstattPos)
    }

    for (const k of kunden) {
      if (k.lat == null || k.lng == null) continue
      const pos: [number, number] = [k.lat, k.lng]
      const adresse = [k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      L.marker(pos)
        .bindPopup(`<strong>${k.vorname ?? ''} ${k.nachname}</strong>${adresse ? `<br>${adresse}` : ''}`)
        .addTo(group)
      punkte.push(pos)
    }

    if (punkte.length > 0) {
      map.fitBounds(punkte, { padding: [40, 40], maxZoom: 14 })
    }
  }, [kunden, werkstattPos, firma.firma_name, firma.firma_strasse, mapBereit])

  return (
    <div className="space-y-2">
      {geocodiereAnzahl > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Ermittle Standorte für {geocodiereAnzahl} Kunde{geocodiereAnzahl !== 1 ? 'n' : ''}...
        </div>
      )}
      <div ref={mapDivRef} className="w-full h-[65vh] min-h-[400px] rounded-xl overflow-hidden border border-gray-200" />
    </div>
  )
}
