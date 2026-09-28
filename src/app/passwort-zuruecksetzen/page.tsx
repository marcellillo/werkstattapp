'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PasswortZuruecksetzenPage() {
  const router = useRouter()
  const supabase = createClient()
  const [bereit, setBereit] = useState(false)
  const [pruefeLink, setPruefeLink] = useState(true)
  const [passwort, setPasswort] = useState('')
  const [passwortBestaetigen, setPasswortBestaetigen] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [speichern, setSpeichern] = useState(false)
  const [erfolg, setErfolg] = useState(false)

  useEffect(() => {
    // Der Recovery-Token steckt im URL-Fragment (#access_token=...) und wird vom
    // Browser-Client automatisch verarbeitet -- das Event PASSWORD_RECOVERY zeigt an,
    // dass die Session daraus erfolgreich aufgebaut wurde.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setBereit(true)
        setPruefeLink(false)
      }
    })

    // Falls das Event bereits vor dem Setzen des Listeners gefeuert ist (z.B. bei
    // schnellem Laden), zusätzlich einmal direkt prüfen.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setBereit(true)
      setPruefeLink(false)
    })

    const timeout = setTimeout(() => setPruefeLink(false), 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)

    if (passwort.length < 6) {
      setFehler('Das Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }
    if (passwort !== passwortBestaetigen) {
      setFehler('Die Passwörter stimmen nicht überein.')
      return
    }

    setSpeichern(true)
    const { error } = await supabase.auth.updateUser({ password: passwort })
    setSpeichern(false)

    if (error) {
      setFehler(error.message)
      return
    }

    setErfolg(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {pruefeLink ? (
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <h1 className="text-xl font-bold text-gray-900">Link wird geprüft...</h1>
          </div>
        ) : erfolg ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-green-600">Passwort geändert!</h1>
            <p className="text-gray-600 mt-2">Du wirst weitergeleitet...</p>
          </div>
        ) : !bereit ? (
          <div className="text-center">
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-red-600">Link ungültig oder abgelaufen</h1>
            <p className="text-gray-600 mt-2">
              Bitte fordere einen neuen Link an oder wende dich an deinen Administrator.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Neues Passwort setzen</h1>
            <p className="text-gray-600 mb-6">Bitte wähle ein neues Passwort für dein Konto.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
                <input
                  type="password"
                  value={passwort}
                  onChange={(e) => setPasswort(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
                <input
                  type="password"
                  value={passwortBestaetigen}
                  onChange={(e) => setPasswortBestaetigen(e.target.value)}
                  placeholder="Passwort wiederholen"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {fehler && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{fehler}</div>}

              <button
                type="submit"
                disabled={speichern}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                {speichern ? 'Wird gespeichert...' : 'Passwort speichern'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
