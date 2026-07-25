'use client'

import Link from 'next/link'
import { Users, Lock, Settings } from 'lucide-react'

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
        <p className="text-slate-600 mt-1">Verwalten Sie Ihren Betrieb</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mitarbeiter Card */}
        <Link href="/admin/mitarbeiter" className="group">
          <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Mitarbeiter</h2>
                <p className="text-sm text-slate-600">Laden Sie Mitarbeiter ein und verteilen Sie Rollen</p>
              </div>
            </div>
          </div>
        </Link>

        {/* Features Card */}
        <Link href="/admin/betrieb-features" className="group">
          <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <Lock className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Features</h2>
                <p className="text-sm text-slate-600">Aktivieren/deaktivieren Sie Features für Ihren Betrieb</p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Tipps für Admins</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Laden Sie Ihre Mitarbeiter ein und weisen Sie ihnen Rollen zu</li>
          <li>✓ Konfigurieren Sie Features basierend auf Ihren Bedürfnissen</li>
          <li>✓ Nur Admins können Mitarbeiter verwalten und Features einstellen</li>
        </ul>
      </div>
    </div>
  )
}
