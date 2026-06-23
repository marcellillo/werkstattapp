'use client'
import { useRef, useState } from 'react'
import { Upload, X, ChevronDown } from 'lucide-react'

export interface MobilefahrzeugData {
  bNummer: string
  bezeichnung: string
  marke: string
  modell: string
  fahrgestellnummer: string
  baujahr: string
  kilometerstand: string
  kraftstoff: string
  getriebe: string
  farbe: string
  preis: string
  hu: string
  karosserie: string
}

interface Props {
  onSelect: (data: MobilefahrzeugData) => void
}

// Maps common Mobile.de column header variants to our field names
const COLUMN_MAP: Record<string, keyof MobilefahrzeugData> = {
  // B-Nummer
  'bestandsnummer': 'bNummer',
  'b-nummer': 'bNummer',
  'interne nr': 'bNummer',
  'interne nummer': 'bNummer',
  'nr': 'bNummer',
  // Bezeichnung
  'bezeichnung': 'bezeichnung',
  'titel': 'bezeichnung',
  'fahrzeugbezeichnung': 'bezeichnung',
  // Marke
  'marke': 'marke',
  'hersteller': 'marke',
  // Modell
  'modell': 'modell',
  'modellbezeichnung': 'modell',
  // FIN
  'fahrgestellnummer': 'fahrgestellnummer',
  'vin': 'fahrgestellnummer',
  'fin': 'fahrgestellnummer',
  // Baujahr / Erstzulassung
  'baujahr': 'baujahr',
  'erstzulassung': 'baujahr',
  'ez': 'baujahr',
  'erstzulassung (monat/jahr)': 'baujahr',
  // KM-Stand
  'kilometerstand': 'kilometerstand',
  'km-stand': 'kilometerstand',
  'laufleistung': 'kilometerstand',
  'km': 'kilometerstand',
  // Kraftstoff
  'kraftstoff': 'kraftstoff',
  'kraftstoffart': 'kraftstoff',
  'antriebsart': 'kraftstoff',
  // Getriebe
  'getriebe': 'getriebe',
  'getriebetyp': 'getriebe',
  // Farbe
  'farbe': 'farbe',
  'außenfarbe': 'farbe',
  'aussenfarbe': 'farbe',
  // Preis
  'preis': 'preis',
  'verkaufspreis': 'preis',
  'bruttopreis': 'preis',
  'preis (brutto)': 'preis',
  // HU
  'hu': 'hu',
  'hauptuntersuchung': 'hu',
  'hu/au': 'hu',
  // Karosserie
  'karosserieform': 'karosserie',
  'karosserie': 'karosserie',
  'aufbauart': 'karosserie',
}

function parseExcelDate(val: unknown): string {
  if (!val) return ''
  // Excel serial date
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.getFullYear().toString()
  }
  const s = String(val).trim()
  // MM/YYYY or MM.YYYY
  const m = s.match(/^(\d{1,2})[./](\d{4})$/)
  if (m) return m[2]
  // Just year
  if (/^\d{4}$/.test(s)) return s
  return s
}

function parseRow(headers: string[], row: unknown[]): MobilefahrzeugData {
  const data: Partial<MobilefahrzeugData> = {}
  headers.forEach((h, i) => {
    const key = COLUMN_MAP[h.toLowerCase().trim()]
    if (key && row[i] != null && row[i] !== '') {
      data[key] = String(row[i]).trim()
    }
  })

  // If no explicit marke/modell, try to parse from bezeichnung
  if (!data.marke && data.bezeichnung) {
    const parts = data.bezeichnung.split(' ')
    data.marke = parts[0] ?? ''
    data.modell = parts.slice(1, 3).join(' ')
  }

  // Normalize baujahr
  if (data.baujahr) data.baujahr = parseExcelDate(data.baujahr)

  // Strip non-digits from km
  if (data.kilometerstand) data.kilometerstand = data.kilometerstand.replace(/\D/g, '')

  // Strip currency symbols from preis
  if (data.preis) data.preis = data.preis.replace(/[^0-9,.]/g, '').replace(',', '.')

  return {
    bNummer: data.bNummer ?? '',
    bezeichnung: data.bezeichnung ?? '',
    marke: data.marke ?? '',
    modell: data.modell ?? '',
    fahrgestellnummer: data.fahrgestellnummer ?? '',
    baujahr: data.baujahr ?? '',
    kilometerstand: data.kilometerstand ?? '',
    kraftstoff: data.kraftstoff ?? '',
    getriebe: data.getriebe ?? '',
    farbe: data.farbe ?? '',
    preis: data.preis ?? '',
    hu: data.hu ?? '',
    karosserie: data.karosserie ?? '',
  }
}

export function MobileImport({ onSelect }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fahrzeuge, setFahrzeuge] = useState<MobilefahrzeugData[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setFileName(file.name)

    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })

      if (rows.length < 2) {
        setError('Datei enthält keine Daten.')
        return
      }

      const headers = (rows[0] as string[]).map(h => String(h ?? '').trim())
      const parsed = (rows.slice(1) as unknown[][])
        .filter(r => r.some(c => c !== ''))
        .map(r => parseRow(headers, r))
        .filter(f => f.bNummer || f.fahrgestellnummer || f.marke)

      if (parsed.length === 0) {
        setError('Keine Fahrzeuge erkannt. Bitte prüfe das Dateiformat.')
        return
      }

      setFahrzeuge(parsed)
      setOpen(true)
    } catch {
      setError('Fehler beim Lesen der Datei.')
    }

    // Reset input so same file can be re-uploaded
    e.target.value = ''
  }

  const filtered = fahrzeuge.filter(f => {
    const q = search.toLowerCase()
    return (
      f.bNummer.toLowerCase().includes(q) ||
      f.marke.toLowerCase().includes(q) ||
      f.modell.toLowerCase().includes(q) ||
      f.fahrgestellnummer.toLowerCase().includes(q)
    )
  })

  function select(f: MobilefahrzeugData) {
    onSelect(f)
    setOpen(false)
    setSearch('')
  }

  function clear() {
    setFahrzeuge([])
    setFileName('')
    setOpen(false)
    setSearch('')
    setError('')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Mobile.de Export laden
        </button>
        {fileName && (
          <div className="flex items-center gap-1.5 text-xs text-gray-800">
            <span className="font-medium">{fileName}</span>
            <span className="text-gray-600">({fahrzeuge.length} Fahrzeuge)</span>
            <button type="button" onClick={clear} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {fahrzeuge.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 border border-purple-300 bg-white rounded-lg text-sm text-gray-900 hover:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <span className="text-gray-600">B-Nummer wählen und Daten übernehmen...</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Suchen nach B-Nummer, Marke, Modell..."
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-gray-400 text-center">Keine Ergebnisse</p>
                ) : (
                  filtered.map((f, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => select(f)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-purple-50 text-left border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <span className="shrink-0 mt-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded">
                        {f.bNummer ? `B-${f.bNummer}` : '–'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {f.marke} {f.modell}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {[f.fahrgestellnummer, f.baujahr && `BJ ${f.baujahr}`, f.kilometerstand && `${Number(f.kilometerstand).toLocaleString('de-DE')} km`].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {f.preis && (
                        <span className="shrink-0 ml-auto text-sm font-semibold text-gray-900">
                          {Number(f.preis).toLocaleString('de-DE')} €
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
