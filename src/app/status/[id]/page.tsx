'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

interface Auftrag {
  id: string
  status: string
  beschreibung: string
  erstellt_am: string
  bearbeiter_id?: string
  fahrzeug?: { kennzeichen: string; marke: string; model: string }
  betrieb?: { name: string; firma_telefon: string; firma_email: string }
  bearbeiter?: { full_name: string; email?: string }
}

export default function StatusPage() {
  const params = useParams()
  const id = params.id as string
  const [auftrag, setAuftrag] = useState<Auftrag | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!id) return

    // Initialer Load
    const loadAuftrag = async () => {
      const { data: auftragData } = await supabase
        .from('auftraege')
        .select('*, fahrzeug:fahrzeuge(*), betrieb:betriebe(*), bearbeiter:profiles(full_name, email)')
        .eq('id', id)
        .single()

      if (auftragData) {
        // Load betrieb settings for contact info
        const { data: settingsData } = await supabase
          .from('betrieb_settings')
          .select('firma_name, firma_telefon, firma_email')
          .eq('betrieb_id', auftragData.betrieb_id)
          .single()

        setAuftrag({
          ...auftragData,
          betrieb: {
            name: settingsData?.firma_name || auftragData.betrieb?.name || 'Werkstatt',
            firma_telefon: settingsData?.firma_telefon || '',
            firma_email: settingsData?.firma_email || '',
          },
        })
      }
      setLoading(false)
    }

    loadAuftrag()

    // Realtime Listener
    const subscription = supabase
      .channel(`auftrag:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'auftraege', filter: `id=eq.${id}` },
        (payload) => {
          setAuftrag((prev) => (prev ? { ...prev, ...payload.new } : null))
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [id, supabase])

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

  const statusLabels: Record<string, string> = {
    neu: '🆕 Neu',
    angenommen: '✅ Angenommen',
    inarbeit: '⚙️ In Arbeit',
    fertig: '✅ Fertig',
    abgeholt: '🚗 Abgeholt',
  }

  const statusColors: Record<string, string> = {
    neu: 'bg-blue-500',
    angenommen: 'bg-yellow-500',
    inarbeit: 'bg-orange-500',
    fertig: 'bg-green-500',
    abgeholt: 'bg-green-600',
  }

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
              {auftrag.status === 'fertig' ? '✅' :
               auftrag.status === 'inarbeit' ? '⚙️' :
               auftrag.status === 'angenommen' ? '📋' :
               auftrag.status === 'abgeholt' ? '🚗' : '📝'}
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
                <p className="text-lg font-semibold text-gray-900">{auftrag.fahrzeug?.model}</p>
              </div>
            </div>

            {/* Bearbeiter */}
            {auftrag.bearbeiter && (
              <div className="flex justify-between items-center pb-4 border-b">
                <div>
                  <p className="text-sm text-gray-600">🔧 Bearbeiter</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {auftrag.bearbeiter.full_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Kontakt</p>
                  <p className="text-sm text-blue-600 font-semibold">{auftrag.bearbeiter.email || '—'}</p>
                </div>
              </div>
            )}

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
            {['neu', 'angenommen', 'inarbeit', 'fertig', 'abgeholt'].map((s, i) => (
              <div key={s} className="flex flex-col items-center flex-1">
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold transition-all duration-500 ${
                    ['neu', 'angenommen', 'inarbeit', 'fertig', 'abgeholt'].indexOf(auftrag.status) >= i
                      ? statusColors[s]
                      : 'bg-gray-300'
                  }`}
                >
                  {i + 1}
                </div>
                <p className="text-xs text-gray-600 mt-2 capitalize text-center">{s}</p>
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
