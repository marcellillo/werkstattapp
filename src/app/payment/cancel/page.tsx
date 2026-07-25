'use client'

import { useRouter } from 'next/navigation'
import { XCircle } from 'lucide-react'

export default function PaymentCancelPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <XCircle className="w-16 h-16 text-red-600 mx-auto mb-6" />

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Zahlung abgebrochen</h1>

        <p className="text-slate-600 mb-6">
          Die Zahlung wurde abgebrochen. Ihr Abonnement wurde nicht aktiviert.
        </p>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 text-left">
          <h2 className="font-semibold text-slate-900 mb-3">Was können Sie tun?</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-orange-600 font-bold">•</span>
              <span>Versuchen Sie es erneut mit einer anderen Zahlungsmethode</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-600 font-bold">•</span>
              <span>Überprüfen Sie Ihre Kartendaten</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-600 font-bold">•</span>
              <span>Kontaktieren Sie den Support bei Fragen</span>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.back()}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Zahlungsversuch wiederholen
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full px-6 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200"
          >
            Zum Dashboard
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Falls Sie weiterhin Probleme haben, kontaktieren Sie bitte unseren Support:
          <br />
          <a href="mailto:support@werkstatt-app.de" className="text-blue-600 hover:underline">
            support@werkstatt-app.de
          </a>
        </p>
      </div>
    </div>
  )
}
