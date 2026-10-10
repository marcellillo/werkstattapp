// "Läuft gerade": wer arbeitet seit wann an welchem Auftrag (laufende Arbeitszeiten)
import Link from 'next/link'
import { ChevronRight, Timer } from 'lucide-react'
import { istVergessen } from '@/lib/arbeitszeit'

export type LaufendeZeit = { id: string; name: string; seit: string; auftragId: string; titel: string }

const uhr = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })

export function LaeuftGerade({ zeiten }: { zeiten: LaufendeZeit[] }) {
  if (zeiten.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-800 flex items-center gap-2"><Timer className="w-4 h-4 text-emerald-600" /> Läuft gerade</div>
      <div className="divide-y divide-gray-50">
        {zeiten.map(z => (
          <Link key={z.id} href={`/fahrzeuge/${z.auftragId}#arbeitszeit`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-900 truncate">{z.name} · {z.titel}</span>
              <span className="block text-xs text-gray-500">seit {uhr(z.seit)} Uhr{istVergessen({ start_am: z.seit, ende_am: null }) ? ' — vergessen zu stoppen?' : ''}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
