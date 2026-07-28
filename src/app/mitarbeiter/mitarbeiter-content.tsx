'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Mail, Plus, Copy, Check, Loader2, Calendar } from 'lucide-react'

interface User {
  id: string
  profile_id: string
  role: string
  profiles?: {
    full_name: string
    email: string
  }
}

interface Invitation {
  id: string
  email: string
  token: string
  role: string
  status: string
  erstellt_am: string
  abgelaufen_am: string
}

interface Props {
  betriebId: string
  users: User[]
  invitations: Invitation[]
}

const ROLLEN = {
  admin: 'Admin',
  mechaniker: 'Mechaniker',
  buchhalter: 'Buchhalter',
}

export function MitarbeiterContent({ betriebId, users, invitations }: Props) {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [rolle, setRolle] = useState<'mechaniker' | 'buchhalter' | 'admin'>('mechaniker')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleInvite = async () => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Email erforderlich' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/invitations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), betriebId, rolle }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setMessage({ type: 'success', text: `Einladung gesendet an ${email}!` })
      setEmail('')
      // Reload page to show new invitation
      setTimeout(() => window.location.reload(), 1000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">👥 Mitarbeiter</h1>
        <p className="text-slate-600 mt-1">Verwalte dein Team und lade neue Mitarbeiter ein</p>
      </div>

      {/* Invite Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Neuen Mitarbeiter einladen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div
              className={`p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Email-Adresse
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mechanic@example.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Rolle
              </label>
              <select
                value={rolle}
                onChange={(e) => setRolle(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="mechaniker">Mechaniker</option>
                <option value="buchhalter">Buchhalter</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleInvite}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wird gesendet...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Einladen
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ausstehende Einladungen ({invitations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">{inv.email}</p>
                    <p className="text-sm text-slate-600">
                      {ROLLEN[inv.rolle as keyof typeof ROLLEN]} • {inv.status === 'pending' ? '⏳ Ausstehend' : '✅ Angenommen'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        copyToClipboard(
                          `${process.env.NEXT_PUBLIC_APP_URL}/register?token=${inv.token}`,
                          inv.id
                        )
                      }
                      className="p-2 hover:bg-amber-100 rounded transition"
                      title="Link kopieren"
                    >
                      {copied === inv.id ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Teamsmitglieder ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-slate-500 text-center py-8">Noch keine Mitarbeiter</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">{user.profiles?.full_name || 'Unbekannt'}</p>
                    <p className="text-sm text-slate-600">{user.profiles?.email}</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {ROLLEN[user.rolle as keyof typeof ROLLEN]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
