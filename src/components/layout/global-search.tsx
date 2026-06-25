'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Users, Car, Wrench, Receipt, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Ergebnis = {
  id: string
  typ: 'kunde' | 'fahrzeug' | 'auftrag' | 'rechnung'
  titel: string
  untertitel: string
  href: string
}

const TYP_CONFIG = {
  kunde:    { label: 'Kunde',    icon: Users,    color: 'text-blue-600',   bg: 'bg-blue-50' },
  fahrzeug: { label: 'Fahrzeug', icon: Car,      color: 'text-green-600',  bg: 'bg-green-50' },
  auftrag:  { label: 'Auftrag',  icon: Wrench,   color: 'text-orange-600', bg: 'bg-orange-50' },
  rechnung: { label: 'Rechnung', icon: Receipt,  color: 'text-purple-600', bg: 'bg-purple-50' },
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function GlobalSearch() {
  const supabase = createClient()
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [query, setQuery] = useState('')
  const [ergebnisse, setErgebnisse] = useState<Ergebnis[]>([])
  const [laden, setLaden] = useState(false)
  const [aktiv, setAktiv] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 220)

  const suchen = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setErgebnisse([]); return }
    setLaden(true)

    // Tokens: "Bauer Golf" → ["bauer", "golf"]
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(t => t.length >= 2)
    const term = q.trim()

    // Alle vier Quellen parallel laden
    // Fahrzeuge + Kunden immer mit Join, damit "Bauer Golf" cross-table klappt
    const [
      { data: fahrzeugeRaw },
      { data: kundenRaw },
      { data: auftraegeRaw },
      { data: rechnungenRaw },
    ] = await Promise.all([
      supabase
        .from('fahrzeuge')
        .select('id, kennzeichen, marke, modell, kunde:kunden(id, vorname, nachname, telefon, email)')
        .limit(200),
      supabase
        .from('kunden')
        .select('id, vorname, nachname, telefon, email')
        .or(`vorname.ilike.%${term}%,nachname.ilike.%${term}%,telefon.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(5),
      supabase
        .from('auftraege')
        .select('id, arbeiten, status, fahrzeug:fahrzeuge(id, kennzeichen, marke, modell, kunde:kunden(vorname, nachname))')
        .or(`arbeiten.ilike.%${term}%`)
        .not('status', 'eq', 'storniert')
        .limit(5),
      supabase
        .from('rechnungen')
        .select('id, lieferant, rechnungsnummer, gesamt')
        .or(`lieferant.ilike.%${term}%,rechnungsnummer.ilike.%${term}%`)
        .limit(3),
    ])

    // Fahrzeuge client-seitig filtern: jeder Token muss irgendwo matchen
    // (kennzeichen, marke, modell ODER kunde.vorname/nachname)
    function fahrzeugMatcht(f: any): boolean {
      const haystack = [
        f.kennzeichen ?? '',
        f.marke ?? '',
        f.modell ?? '',
        (f.kunde as any)?.vorname ?? '',
        (f.kunde as any)?.nachname ?? '',
        `${(f.kunde as any)?.vorname ?? ''} ${(f.kunde as any)?.nachname ?? ''}`,
        `${f.marke ?? ''} ${f.modell ?? ''}`,
        `${(f.kunde as any)?.nachname ?? ''} ${f.marke ?? ''} ${f.modell ?? ''}`,
      ].map(s => s.toLowerCase())
      return tokens.every(token => haystack.some(h => h.includes(token)))
    }

    const fahrzeuge = (fahrzeugeRaw ?? []).filter(fahrzeugMatcht).slice(0, 5)

    // Kunden: zusätzlich auch über Fahrzeuge suchen (Kunde hat Golf → bei "Müller Golf" Kunden finden)
    const kundenIds = new Set((kundenRaw ?? []).map(k => k.id))
    // Kunden die über Fahrzeug-Match gefunden wurden
    fahrzeuge.forEach(f => {
      const k = f.kunde as any
      if (k?.id) kundenIds.add(k.id)
    })
    // Alle unique Kunden aus beiden Quellen zusammenführen
    const alleKunden = [
      ...(kundenRaw ?? []),
      ...fahrzeuge
        .map(f => f.kunde as any)
        .filter(k => k?.id && !(kundenRaw ?? []).find((r: any) => r.id === k.id)),
    ].filter(Boolean).slice(0, 5)

    const results: Ergebnis[] = [
      // Kunden
      ...alleKunden.map((k: any) => ({
        id: k.id, typ: 'kunde' as const,
        titel: `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim(),
        untertitel: [k.telefon, k.email].filter(Boolean).join(' · '),
        href: `/kunden`,
      })),
      // Fahrzeuge
      ...fahrzeuge.map((f: any) => {
        const k = f.kunde as any
        return {
          id: f.id, typ: 'fahrzeug' as const,
          titel: `${f.kennzeichen} — ${f.marke ?? ''} ${f.modell ?? ''}`.trim(),
          untertitel: k ? `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim() : '',
          href: `/fahrzeuge/${f.id}`,
        }
      }),
      // Aufträge
      ...(auftraegeRaw ?? []).map((a: any) => {
        const fz = a.fahrzeug as any
        const kd = fz?.kunde as any
        return {
          id: a.id, typ: 'auftrag' as const,
          titel: fz ? `${fz.kennzeichen} — ${fz.marke ?? ''} ${fz.modell ?? ''}`.trim() : 'Auftrag',
          untertitel: [
            kd ? `${kd.vorname ?? ''} ${kd.nachname ?? ''}`.trim() : null,
            (a.arbeiten ?? '').split('\n')[0].substring(0, 50),
          ].filter(Boolean).join(' · '),
          href: fz ? `/fahrzeuge/${fz.id}` : `/fahrzeuge`,
        }
      }),
      // Rechnungen
      ...(rechnungenRaw ?? []).map((r: any) => ({
        id: r.id, typ: 'rechnung' as const,
        titel: r.rechnungsnummer ? `RE ${r.rechnungsnummer}` : 'Rechnung',
        untertitel: [r.lieferant, r.gesamt != null ? `${Number(r.gesamt).toFixed(2)} €` : null].filter(Boolean).join(' · '),
        href: `/rechnungen`,
      })),
    ]

    // Duplikate nach id entfernen
    const seen = new Set<string>()
    const unique = results.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true })

    setErgebnisse(unique)
    setAktiv(-1)
    setLaden(false)
  }, [supabase])

  useEffect(() => { suchen(debouncedQuery) }, [debouncedQuery, suchen])

  // Außen-Klick schließt
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        schliessen()
      }
    }
    if (offen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [offen])

  // Tastatur-Navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!offen) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); oeffnen() }
        return
      }
      if (e.key === 'Escape') { schliessen(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setAktiv(v => Math.min(v + 1, ergebnisse.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setAktiv(v => Math.max(v - 1, -1)) }
      if (e.key === 'Enter' && aktiv >= 0 && ergebnisse[aktiv]) {
        navigieren(ergebnisse[aktiv])
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [offen, ergebnisse, aktiv])

  function oeffnen() {
    setOffen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function schliessen() {
    setOffen(false)
    setQuery('')
    setErgebnisse([])
    setAktiv(-1)
  }

  function navigieren(e: Ergebnis) {
    schliessen()
    router.push(e.href)
  }

  // Gruppiert nach Typ
  const gruppen = (['kunde', 'fahrzeug', 'auftrag', 'rechnung'] as const)
    .map(typ => ({ typ, items: ergebnisse.filter(e => e.typ === typ) }))
    .filter(g => g.items.length > 0)

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger-Button (kollabiert) */}
      {!offen && (
        <button
          onClick={oeffnen}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-sm text-gray-400 transition-colors min-w-[160px] sm:min-w-[220px]"
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left">Suchen…</span>
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono bg-white border border-gray-200 rounded px-1 py-0.5 text-gray-400">
            ⌘K
          </kbd>
        </button>
      )}

      {/* Aufgeklappte Suche */}
      {offen && (
        <div className="flex items-center gap-2 min-w-[280px] sm:min-w-[360px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Kunden, Kennzeichen, Auftrag…"
              className="w-full pl-9 pr-4 py-2 border border-orange-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white shadow-sm"
            />
            {laden && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
          </div>
          <button onClick={schliessen} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ergebnis-Dropdown */}
      {offen && (query.length >= 2) && (
        <div className="absolute top-full mt-2 right-0 w-[360px] sm:w-[420px] bg-white border border-gray-200 rounded-2xl shadow-2xl z-[100] overflow-hidden">
          {laden && ergebnisse.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Suche läuft…
            </div>
          ) : ergebnisse.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              Keine Ergebnisse für „{query}"
            </div>
          ) : (
            <div className="py-2 max-h-[420px] overflow-y-auto">
              {gruppen.map(({ typ, items }) => {
                const cfg = TYP_CONFIG[typ]
                const Icon = cfg.icon
                return (
                  <div key={typ}>
                    <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                      {cfg.label}
                    </div>
                    {items.map(e => {
                      const idx = ergebnisse.indexOf(e)
                      return (
                        <button
                          key={e.id}
                          onClick={() => navigieren(e)}
                          onMouseEnter={() => setAktiv(idx)}
                          className={cn(
                            'w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors',
                            aktiv === idx ? 'bg-orange-50' : 'hover:bg-gray-50'
                          )}
                        >
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
                            <Icon className={cn('w-4 h-4', cfg.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{e.titel}</p>
                            {e.untertitel && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">{e.untertitel}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
              <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>{ergebnisse.length} Ergebnis{ergebnisse.length !== 1 ? 'se' : ''}</span>
                <span>↑↓ navigieren · Enter öffnen · Esc schließen</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
