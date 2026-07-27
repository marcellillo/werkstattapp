import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function StatusPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: auftrag, error } = await supabase
    .from('auftraege')
    .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(*)')
    .eq('id', params.id)
    .single()

  if (error || !auftrag) {
    notFound()
  }

  const statusLabels: Record<string, string> = {
    neu: '🆕 Neu',
    angenommen: '✅ Angenommen',
    inarbeit: '⚙️ In Arbeit',
    fertig: '✅ Fertig',
    abgeholt: '🚗 Abgeholt',
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
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">
              {auftrag.status === 'fertig' ? '✅' :
               auftrag.status === 'inarbeit' ? '⚙️' :
               auftrag.status === 'angenommen' ? '📋' :
               auftrag.status === 'abgeholt' ? '🚗' : '📝'}
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {statusLabels[auftrag.status] || auftrag.status}
            </h2>
            <p className="text-gray-600">Auftrag #{auftrag.id?.substring(0, 8).toUpperCase()}</p>
          </div>

          {/* Details */}
          <div className="space-y-4 border-t pt-6">
            {/* Fahrzeug */}
            <div className="flex justify-between items-center pb-4 border-b">
              <div>
                <p className="text-sm text-gray-600">Fahrzeug</p>
                <p className="text-lg font-semibold text-gray-900">
                  {auftrag.fahrzeug?.kennzeichen}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">{auftrag.fahrzeug?.marke}</p>
                <p className="text-lg font-semibold text-gray-900">{auftrag.fahrzeug?.model}</p>
              </div>
            </div>

            {/* Kunde */}
            <div className="flex justify-between items-center pb-4 border-b">
              <div>
                <p className="text-sm text-gray-600">Kunde</p>
                <p className="text-lg font-semibold text-gray-900">
                  {auftrag.kunde?.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Telefon</p>
                <p className="text-lg font-semibold text-gray-900">{auftrag.kunde?.telefon || '—'}</p>
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

        {/* Status Timeline */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Zeitverlauf</h3>
          <div className="space-y-4">
            {auftrag.status === 'fertig' && (
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-500 text-white">
                    ✅
                  </div>
                </div>
                <div className="ml-4">
                  <p className="font-semibold text-gray-900">Fertig</p>
                  <p className="text-sm text-gray-600">Der Auftrag wurde abgeschlossen</p>
                </div>
              </div>
            )}
            {auftrag.status === 'abgeholt' && (
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-500 text-white">
                    🚗
                  </div>
                </div>
                <div className="ml-4">
                  <p className="font-semibold text-gray-900">Abgeholt</p>
                  <p className="text-sm text-gray-600">Ihr Fahrzeug wurde abgeholt</p>
                </div>
              </div>
            )}
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
