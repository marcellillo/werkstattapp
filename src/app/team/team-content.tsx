// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HardHat, Phone, Mail, Shield } from 'lucide-react'
import { getRoleLabel } from '@/lib/utils'
import type { Profile, UserRole } from '@/types/database'

const ROLES: UserRole[] = ['admin', 'bauleiter', 'projektleiter', 'monteur', 'buero']

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  bauleiter: 'bg-blue-100 text-blue-700',
  projektleiter: 'bg-cyan-100 text-cyan-700',
  monteur: 'bg-orange-100 text-orange-700',
  buero: 'bg-gray-100 text-gray-700',
}

interface Props {
  profiles: Profile[]
  currentProfile: Profile | null
}

export function TeamContent({ profiles: initialProfiles, currentProfile }: Props) {
  const supabase = createClient()
  const [profiles, setProfiles] = useState(initialProfiles)
  const isAdmin = currentProfile?.role === 'admin'

  async function updateRole(profileId: string, newRole: UserRole) {
    if (!isAdmin) return
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p))
    await supabase.from('profiles').update({ role: newRole }).eq('id', profileId)
  }

  const groupedByRole = ROLES.reduce((acc, role) => {
    acc[role] = profiles.filter(p => p.role === role)
    return acc
  }, {} as Record<UserRole, Profile[]>)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{profiles.length} Teammitglieder</h2>
        <p className="text-sm text-gray-800">Rollenverwaltung und Mitarbeiterprofile</p>
        {!isAdmin && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><Shield className="w-3 h-3" />Nur Administratoren können Rollen ändern</p>}
      </div>

      {/* By Role */}
      {ROLES.map(role => {
        const members = groupedByRole[role] ?? []
        if (members.length === 0) return null
        return (
          <div key={role}>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              {getRoleLabel(role)} ({members.length})
            </h3>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {members.map(profile => (
                <Card key={profile.id} className={profile.id === currentProfile?.id ? 'ring-2 ring-blue-400' : ''}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                        {profile.full_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 truncate">{profile.full_name}</p>
                          {profile.id === currentProfile?.id && <Badge variant="secondary" className="text-xs">Ich</Badge>}
                        </div>
                        <p className="text-xs text-gray-800 truncate">{profile.email}</p>
                        {profile.phone && (
                          <a href={`tel:${profile.phone}`} className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600 mt-1 transition-colors">
                            <Phone className="w-3 h-3" />{profile.phone}
                          </a>
                        )}
                        <div className="mt-2">
                          {isAdmin ? (
                            <Select value={profile.role} onValueChange={v => updateRole(profile.id, v as UserRole)}>
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map(r => <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[profile.role as UserRole]}`}>
                              {getRoleLabel(profile.role)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

