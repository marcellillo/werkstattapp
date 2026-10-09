'use client'
// Auftrags-Board: alle laufenden Kundenaufträge als Spalten nach Status. Jede Karte hat einen Knopf für den
// nächsten Schritt — der öffnet den Auftrag und startet dort den normalen Ablauf (Bühne, Checkliste, …).
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Package, ChevronRight } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { berechnePrioritaet } from '@/lib/prioritaet'
import type { FahrzeugStatus } from '@/types/database'

const SPALTEN: { status: FahrzeugStatus; titel: string; kopf: string }[] = [
  { status: 'angenommen', titel: 'Angenommen', kopf: 'bg-blue-50 text-blue-800 border-blue-200' },
  { status: 'diagnose', titel: 'Diagnose', kopf: 'bg-purple-50 text-purple-800 border-purple-200' },
  { status: 'reparatur', titel: 'In Arbeit', kopf: 'bg-orange-50 text-orange-800 border-orange-200' },
  { status: 'warten_teile', titel: 'Warten auf Teile', kopf: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  { status: 'fertig', titel: 'Fertig / abholbereit', kopf: 'bg-green-50 text-green-800 border-green-200' },
]

// nächster Schritt je Status → Aktion, die die Auftragsseite beim Öffnen ausführt (?aktion=…)
const WEITER: Partial<Record<FahrzeugStatus, { aktion: FahrzeugStatus; text: string }>> = {
  angenommen: { aktion: 'reparatur', text: 'Arbeit starten' },
  diagnose: { aktion: 'reparatur', text: 'Arbeit starten' },
  reparatur: { aktion: 'fertig', text: 'Fertig melden' },
  warten_teile: { aktion: 'reparatur', text: 'Weiter arbeiten' },
  fertig: { aktion: 'ausgeliefert', text: 'Übergeben' },
}

export function AuftragsBoard({ auftraege }: { auftraege: any[] }) {
  const router = useRouter()
  const heute = new Date().toISOString().split('T')[0]

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory xl:snap-none">
      {SPALTEN.map(sp => {
        const karten = auftraege.filter(a => a.status === sp.status)
        return (
          <section key={sp.status} className="flex-shrink-0 w-[85%] sm:w-72 xl:flex-1 xl:min-w-[220px] snap-start">
            <header className={cn('flex items-center justify-between px-3 py-2 rounded-xl border text-sm font-semibold mb-2', sp.kopf)}>
              <span>{sp.titel}</span>
              <span className="text-xs font-bold bg-white/70 rounded-full px-2 py-0.5">{karten.length}</span>
            </header>
            <div className="space-y-2">
              {karten.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">Keine Aufträge</p>
              )}
              {karten.map(a => {
                const teileOffen = (a.ersatzteile ?? []).filter((t: any) => ['nicht_bestellt', 'bestellt'].includes(t.status)).length
                const ueberfaellig = a.geplante_fertigstellung && a.geplante_fertigstellung < heute && !['fertig', 'ausgeliefert'].includes(a.status)
                const prio = berechnePrioritaet(a)
                const weiter = WEITER[a.status as FahrzeugStatus]
                return (
                  <div
                    key={a.id}
                    onClick={() => router.push(`/fahrzeuge/${a.id}`)}
                    className={cn(
                      'bg-white border rounded-xl p-3 cursor-pointer hover:shadow-sm transition-all',
                      prio.stufe === 'kritisch' ? 'border-red-200 bg-red-50/30' : 'border-gray-200 hover:border-orange-200'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className={cn(
                        'mt-1 w-2 h-2 rounded-full flex-shrink-0',
                        prio.stufe === 'kritisch' ? 'bg-red-500' : prio.stufe === 'hoch' ? 'bg-orange-400' : prio.stufe === 'mittel' ? 'bg-yellow-400' : 'bg-gray-300'
                      )} title={`Priorität: ${prio.stufe}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-semibold text-gray-900">{a.fahrzeug?.kennzeichen || a.auftrag_nr}</p>
                        <p className="text-sm text-gray-700 truncate">{a.fahrzeug?.marke} {a.fahrzeug?.modell}</p>
                        {a.kunde && <p className="text-xs text-gray-500 truncate">{a.kunde.vorname} {a.kunde.nachname}</p>}
                      </div>
                    </div>
                    {a.arbeiten && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{a.arbeiten}</p>}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {a.hebebuehne && <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-full">{a.hebebuehne.bezeichnung}</span>}
                      {teileOffen > 0 && (
                        <span className="text-[11px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Package className="w-3 h-3" />{teileOffen}
                        </span>
                      )}
                      {ueberfaellig
                        ? <span className="text-[11px] text-red-600 font-medium">⚠ überfällig</span>
                        : a.geplante_fertigstellung && <span className="text-[11px] text-gray-400">bis {formatDate(a.geplante_fertigstellung)}</span>}
                    </div>
                    {weiter && (
                      <Link
                        href={`/fahrzeuge/${a.id}?aktion=${weiter.aktion}`}
                        onClick={e => e.stopPropagation()}
                        className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold py-2 transition-colors"
                      >
                        {weiter.text} <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
