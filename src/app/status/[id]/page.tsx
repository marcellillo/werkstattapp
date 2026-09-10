'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Auftrag {
  id: string
  status: string
  beschreibung: string
  erstellt_am: string
  fahrzeug?: { kennzeichen: string; marke: string; modell: string }
  betrieb?: { name: string; firma_telefon: string; firma_email: string }
}

// Muss exakt der CHECK-Constraint auf auftraege.status entsprechen.
const STATUS_REIHENFOLGE = ['angenommen', 'diagnose', 'reparatur', 'warten_teile', 'fertig', 'ausgeliefert']

const statusLabels: Record<string, string> = {
  angenommen: '📋 Angenommen',
  diagnose: '🔍 Diagnose',
  reparatur: '⚙️ In Reparatur',
  warten_teile: '⏳ Wartet auf Teile',
  fertig: '✅ Fertig',
  ausgeliefert: '🚗 Ausgeliefert',
}

const statusColors: Record<string, string> = {
  angenommen: 'bg-blue-500',
  diagnose: 'bg-indigo-500',
  reparatur: 'bg-orange-500',
  warten_teile: 'bg-yellow-500',
  fertig: 'bg-green-500',
  ausgeliefert: 'bg-green-600',
}

const statusIcons: Record<string, string> = {
  angenommen: '📋',
  diagnose: '🔍',
  reparatur: '⚙️',
  warten_teile: '⏳',
  fertig: '✅',
  ausgeliefert: '🚗',
}

export default function StatusPage() {
  const params = useParams()
  const id = params.id as string
  const [auftrag, setAuftrag] = useState<Auftrag | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/status/${id}`, { cache: 'no-store' })
      setAuftrag(res.ok ? await res.json() : null)
    } catch {
      setAuftrag(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    // Kein Realtime-Kanal hier: die oeffentliche Route laeuft ueber den
    // Admin-Client (siehe api/status/[id]/route.ts), Supabase Realtime
    // wuerde fuer einen anonymen Besucher ohnehin an der RLS auf auftraege
    // scheitern. Polling ist fuer eine Status-Seite ausreichend.
    const interval = setInterval(load, 20000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Laden...</p>
        </div>
      </div>
    )
  }

  if (!auftrag) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Auftrag nicht gefunden</h1>
          <p className="text-gray-600">Der angeforderte Auftrag existiert nicht.</p>
        </div>
      </div>
    )
  }

  const aktIndex = STATUS_REIHENFOLGE.indexOf(auftrag.status)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Auftragsstatus</h1>
          <p className="text-gray-600">Übersicht Ihres Auftrags</p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 transition-all duration-500">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4 animate-pulse">
              {statusIcons[auftrag.status] || '📝'}
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {statusLabels[auftrag.status] || auftrag.status}
            </h2>
            <p className="text-gray-600">Auftrag #{auftrag.id?.substring(0, 8).toUpperCase()}</p>
            <p className="text-xs text-gray-500 mt-2">🔄 Wird automatisch aktualisiert</p>
          </div>

          {/* Details */}
          <div className="space-y-4 border-t pt-6">
            {/* Fahrzeug */}
            <div className="flex justify-between items-center pb-4 border-b">
              <div>
                <p className="text-sm text-gray-600">🚗 Fahrzeug</p>
                <p className="text-lg font-semibold text-gray-900">
                  {auftrag.fahrzeug?.kennzeichen}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">{auftrag.fahrzeug?.marke}</p>
                <p className="text-lg font-semibold text-gray-900">{auftrag.fahrzeug?.modell}</p>
              </div>
            </div>

            {/* Werkstatt Kontakt */}
            <div className="flex justify-between items-center pb-4 border-b bg-blue-50 -mx-8 px-8 py-4">
              <div>
                <p className="text-sm text-gray-600">📞 Kontakt</p>
                <p className="text-lg font-semibold text-gray-900">
                  {auftrag.betrieb?.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">{auftrag.betrieb?.firma_telefon}</p>
                <p className="text-sm text-blue-600 font-semibold">{auftrag.betrieb?.firma_email}</p>
              </div>
            </div>

            {/* Datum */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Erstellung</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(auftrag.erstellt_am).toLocaleDateString('de-DE')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Beschreibung</p>
                <p className="text-lg font-semibold text-gray-900 truncate">
                  {auftrag.beschreibung || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Progress */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Fortschritt</h3>
          <div className="flex items-center justify-between">
            {STATUS_REIHENFOLGE.map((s, i) => (
              <div key={s} className="flex flex-col items-center flex-1">
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold transition-all duration-500 ${
                    aktIndex >= i ? statusColors[s] : 'bg-gray-300'
                  }`}
                >
                  {i + 1}
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center">{statusLabels[s]?.replace(/^\S+\s/, '')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Bei Fragen kontaktieren Sie bitte die Werkstatt</p>
        </div>
      </div>
    </div>
  )
}
