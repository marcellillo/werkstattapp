'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Loader2 } from 'lucide-react'

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [betriebName, setBetriebName] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    async function verifyPayment() {
      const betriebId = searchParams.get('betrieb')
      if (!betriebId) {
        setError('Betrieb-ID fehlt')
        setLoading(false)
        return
      }

      try {
        const supabase = await createClient()

        // Fetch betrieb info
        const { data: betrieb, error: betriebError } = await supabase
          .from('betriebe')
          .select('name')
          .eq('id', betriebId)
          .single()

        if (betriebError) throw new Error('Betrieb nicht gefunden')

        setBetriebName(betrieb.name)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Abrufen des Betriebs')
      } finally {
        setLoading(false)
      }
    }

    verifyPayment()
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
      <div className="max-w-md w-full">
        {loading ? (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-emerald-600 mx-auto mb-4 animate-spin" />
            <p className="text-slate-600">Zahlung wird verarbeitet...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-red-600 mb-4 text-lg font-semibold">{error}</div>
            <button
              onClick={() => router.push('/admin')}
              className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Zurück zur Admin
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-6" />

            <h1 className="text-2xl font-bold text-slate-900 mb-2">Zahlung erfolgreich!</h1>

            <p className="text-slate-600 mb-6">
              Vielen Dank für Ihre Zahlung. Ihr Abonnement für{' '}
              <span className="font-semibold text-slate-900">{betriebName}</span> ist jetzt aktiv.
            </p>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 text-left">
              <h2 className="font-semibold text-slate-900 mb-3">Was ist nächste Schritt?</h2>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Ihr Abonnement ist sofort aktiv</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Sie erhalten eine Bestätigungsmail</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Monatliche Rechnungen werden automatisch generiert</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/admin/betrieb-features')}
                className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
              >
                Features konfigurieren
              </button>

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full px-6 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200"
              >
                Zum Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
