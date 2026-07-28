'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    acceptInvitation()
  }, [token])

  const acceptInvitation = async () => {
    if (!token) {
      setMessage({ type: 'error', text: 'Ungültiger Einladungslink' })
      setLoading(false)
      return
    }

    try {
      // Call API to accept invitation
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Fehler beim Akzeptieren der Einladung' })
        setLoading(false)
        return
      }

      setMessage({
        type: 'success',
        text: `Glückwunsch! Du wurdest zum Betrieb hinzugefügt. Deine Rolle: ${data.rolle}`,
      })

      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {loading && (
          <>
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-gray-900">Verarbeitung...</h1>
            <p className="text-gray-600 mt-2">Deine Einladung wird akzeptiert...</p>
          </>
        )}

        {message && (
          <>
            <div className={`text-4xl mb-4 ${message.type === 'success' ? '✅' : '❌'}`}></div>
            <h1 className={`text-2xl font-bold ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {message.type === 'success' ? 'Willkommen!' : 'Fehler'}
            </h1>
            <p className="text-gray-600 mt-2">{message.text}</p>
            {message.type === 'success' && (
              <p className="text-gray-500 text-sm mt-4">Weitergeleitet zum Dashboard...</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
