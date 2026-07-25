'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBetrieb } from '@/lib/betrieb-context'
import { Mail, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface BetriebUser {
  id: string
  profile_id: string
  role: string
  created_at: string
  profile?: {
    email: string
    full_name: string
  }
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  werkstattmeister: 'Werkstattmeister',
  mechaniker: 'Mechaniker',
  buchhalter: 'Buchhalter',
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin (Voll-Zugriff)' },
  { value: 'werkstattmeister', label: 'Werkstattmeister (Betriebsleiter)' },
  { value: 'mechaniker', label: 'Mechaniker (Techniker)' },
  { value: 'buchhalter', label: 'Buchhalter (Rechnungen)' },
]

export default function MitarbeiterPage() {
  const supabase = createClient()

  const betriebContext = useBetrieb()
  const currentBetriebId = betriebContext?.currentBetriebId

  const [mitarbeiter, setMitarbeiter] = useState<BetriebUser[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [success, setSuccess] = useState<string>('')
  const [error, setError] = useState<string>('')

  const [email, setEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState('mechaniker')

  useEffect(() => {
    if (currentBetriebId) {
      loadMitarbeiter()
    } else {
      setLoading(false)
      setError('Keine Betrieb-ID gefunden')
    }
  }, [currentBetriebId])

  async function loadMitarbeiter() {
    if (!currentBetriebId) {
      setError('Keine Betrieb-ID vorhanden')
      setLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('betrieb_users')
        .select('id, profile_id, role, created_at, profile:profiles(email, full_name)')
        .eq('betrieb_id', currentBetriebId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      setMitarbeiter(data || [])
    } catch (err) {
      console.error('Load error:', err)
      setError(err instanceof Error ? err.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!currentBetriebId || !email || !selectedRole) {
      setError('Bitte füllen Sie alle Felder aus')
      return
    }

    setInviting(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          betriebId: currentBetriebId,
          email,
          role: selectedRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Einladung fehlgeschlagen')
      }

      setSuccess(`Einladung an ${email} versendet!`)
      setEmail('')
      setSelectedRole('mechaniker')
      loadMitarbeiter()
    } catch (err) {
      console.error('Invite error:', err)
      setError(err instanceof Error ? err.message : 'Einladung fehlgeschlagen')
    } finally {
      setInviting(false)
    }
  }

  async function deleteMitarbeiter(userId: string) {
    if (!currentBetriebId) return
    if (!confirm('Mitarbeiter wirklich löschen?')) return

    try {
      const { error: delError } = await supabase
        .from('betrieb_users')
        .delete()
        .eq('id', userId)
        .eq('betrieb_id', currentBetriebId)

      if (delError) throw delError

      setSuccess('Mitarbeiter gelöscht')
      loadMitarbeiter()
    } catch (err) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mitarbeiter verwalten</h1>
        <p className="text-slate-600 mt-1">Laden Sie Mitarbeiter ein und verteilen Sie Rollen</p>
      </div>

      {/* Invite Form */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Neuen Mitarbeiter einladen</h2>

        <form onSubmit={handleInvite} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900">{success}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                E-Mail-Adresse
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="max.mueller@example.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Rolle</label>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={inviting || !email}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {inviting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wird versendet...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Einladung versenden
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-600">
            Der Mitarbeiter erhält eine E-Mail mit einem Registrierungs-Link. Die Rolle wird
            automatisch zugewiesen.
          </p>
        </form>
      </div>

      {/* Mitarbeiter Liste */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            Mitarbeiter ({mitarbeiter.length})
          </h2>
        </div>

        {mitarbeiter.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-600">Noch keine Mitarbeiter. Laden Sie einen ein!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    E-Mail
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Rolle
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Seit
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {mitarbeiter.map(ma => (
                  <tr key={ma.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm">
                      <p className="font-medium text-slate-900">{ma.profile?.full_name || '—'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{ma.profile?.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                        {ROLE_LABELS[ma.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(ma.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deleteMitarbeiter(ma.id)}
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
