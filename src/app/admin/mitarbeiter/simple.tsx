'use client'

import { useState } from 'react'
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'werkstattmeister', label: 'Werkstattmeister' },
  { value: 'mechaniker', label: 'Mechaniker' },
  { value: 'buchhalter', label: 'Buchhalter' },
]

export function SimpleMitarbeiter() {
  const [email, setEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState('mechaniker')
  const [inviting, setInviting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          betriebId: 'test-betrieb-id',
          email,
          role: selectedRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Fehler')
        return
      }

      setSuccess(`Email an ${email} versendet!`)
      setEmail('')
    } catch (err) {
      setError('Fehler beim Versand')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mitarbeiter (Einfache Version)</h1>

      {error && <div className="bg-red-100 p-4 rounded text-red-700">{error}</div>}
      {success && <div className="bg-green-100 p-4 rounded text-green-700">{success}</div>}

      <form onSubmit={handleInvite} className="space-y-4 bg-white p-6 rounded-lg border">
        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Rolle</label>
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          >
            {ROLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={inviting}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {inviting ? 'Versendet...' : 'Einladung versenden'}
        </button>
      </form>
    </div>
  )
}
