'use client'
import Link from 'next/link'
import { ClipboardCheck, CheckCircle, Clock, Plus, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { FAHRZEUG_STATUS_LABEL, FAHRZEUG_STATUS_COLOR, type FahrzeugStatus } from '@/types/database'

export function AnnahmeUebersicht({ auftraege }: { auftraege: any[] }) {
  const ohneProtokoll = auftraege.filter(a => !a.annahme_datum)
  const mitProtokoll  = auftraege.filter(a =>  a.annahme_datum)

  function AuftragZeile({ a }: { a: any }) {
    const fz = a.fahrzeug
    const k  = a.kunde
    const hatProtokoll = !!a.annahme_datum
    return (
      <Link href={`/fahrzeuge/${a.id}/annahme`}>
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', hatProtokoll ? 'bg-green-100' : 'bg-orange-100')}>
            {hatProtokoll
              ? <CheckCircle className="w-4 h-4 text-green-600" />
              : <Clock className="w-4 h-4 text-orange-500" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-gray-900">{a.auftrag_nr}</span>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium border', FAHRZEUG_STATUS_COLOR[a.status as FahrzeugStatus] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
                {FAHRZEUG_STATUS_LABEL[a.status as FahrzeugStatus] ?? a.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 truncate">
              {fz ? `${fz.marke} ${fz.modell}${fz.kennzeichen ? ` · ${fz.kennzeichen}` : ''}` : '—'}
              {k ? ` · ${k.vorname} ${k.nachname}` : ''}
            </div>
            {hatProtokoll && a.kostenrahmen_max && (
              <div className="text-xs text-green-600">bis max. {parseFloat(a.kostenrahmen_max).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </div>
      </Link>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Annahme</h1>
          <p className="text-sm text-gray-500 mt-0.5">Annahmeprotokolle für laufende Aufträge</p>
        </div>
        <Link href="/fahrzeuge/neu">
          <button className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" />Neuer Auftrag
          </button>
        </Link>
      </div>

      {/* Ohne Protokoll */}
      {ohneProtokoll.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-700">Protokoll ausstehend ({ohneProtokoll.length})</h2>
          </div>
          <Card className="overflow-hidden border-orange-200">
            <CardContent className="p-0">
              {ohneProtokoll.map(a => <AuftragZeile key={a.id} a={a} />)}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mit Protokoll */}
      {mitProtokoll.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-700">Protokoll erstellt ({mitProtokoll.length})</h2>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {mitProtokoll.map(a => <AuftragZeile key={a.id} a={a} />)}
            </CardContent>
          </Card>
        </div>
      )}

      {auftraege.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Keine offenen Aufträge</p>
          <p className="text-sm mt-1">Alle Aufträge sind ausgeliefert oder storniert</p>
        </div>
      )}
    </div>
  )
}
