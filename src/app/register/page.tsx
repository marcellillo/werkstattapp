'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Invitation {
  email: string
  rolle: string
}

function RegisterContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [loading, setLoading] = useState(true)
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadInvitation()
  }, [token])

  const loadInvitation = async () => {
    if (!token) {
      setError('Ungültiger Einladungslink')
      setLoading(false)
      return
    }

    try {
      // Fetch invitation from API
      const response = await fetch('/api/invitations/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Einladung nicht gefunden')
        setLoading(false)
        return
      }

      setInvitation(data.invitation)
      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!password || !passwordConfirm) {
      setError('Passwort erforderlich')
      return
    }

    if (password !== passwordConfirm) {
      setError('Passwörter stimmen nicht überein')
      return
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein')
      return
    }

    setSubmitting(true)

    try {
      // Sign up with email and password
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation!.email,
        password,
      })

      if (authError) throw authError

      if (!authData.user) throw new Error('Benutzer konnte nicht erstellt werden')

      // Accept invitation
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const acceptData = await response.json()

      if (!response.ok) {
        throw new Error(acceptData.error || 'Fehler beim Akzeptieren der Einladung')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-gray-900">Wird geladen...</h1>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-green-600">Willkommen!</h1>
          <p className="text-gray-600 mt-2">Dein Konto wurde erstellt. Weitergeleitet zum Dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-600">Fehler</h1>
          <p className="text-gray-600 mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Willkommen!</h1>
        <p className="text-gray-600 mb-6">Erstelle dein Konto mit einem Passwort</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={invitation?.email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Passwort wiederholen"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            {submitting ? 'Wird registriert...' : 'Konto erstellen'}
          </button>
        </form>

        <p className="text-gray-500 text-xs mt-4 text-center">
          Rolle: <span className="font-semibold">{invitation?.rolle}</span>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-gray-900">Wird geladen...</h1>
        </div>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  )
}
