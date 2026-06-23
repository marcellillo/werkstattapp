'use client'
import { BookOpen, TrendingUp, FileText, Link2, Lock, ArrowRight } from 'lucide-react'

export function BuchhaltungContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buchhaltung</h1>
        <p className="text-sm text-gray-500 mt-0.5">Finanzübersicht & Schnittstellen</p>
      </div>

      {/* Coming Soon Banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h2 className="font-semibold text-orange-900">Buchhaltungsmodul in Entwicklung</h2>
          <p className="text-sm text-orange-700 mt-1">
            Hier wird bald die vollständige Finanzverwaltung integriert — inklusive Anbindung
            an externe Buchhaltungssoftware wie DATEV, Lexware oder sevDesk.
          </p>
        </div>
      </div>

      {/* Placeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            icon: TrendingUp,
            title: 'Umsatzübersicht',
            desc: 'Monatliche Ein- und Ausgaben auf einen Blick.',
          },
          {
            icon: FileText,
            title: 'Rechnungsexport',
            desc: 'Alle Rechnungen als CSV oder DATEV-kompatible Datei exportieren.',
          },
          {
            icon: Link2,
            title: 'Software-Verknüpfung',
            desc: 'Anbindung an DATEV, Lexware, sevDesk oder Billomat.',
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-3 opacity-60"
          >
            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
              <Icon className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
              <p className="text-xs text-gray-400 mt-1">{desc}</p>
            </div>
            <div className="mt-auto flex items-center gap-1 text-xs text-gray-300 font-medium">
              <Lock className="w-3.5 h-3.5" />
              Demnächst verfügbar
            </div>
          </div>
        ))}
      </div>

      {/* Info note */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">Hinweis für Administratoren:</span>{' '}
          Der Zugriff auf die Buchhaltung ist standardmäßig nur für Admins freigeschaltet.
          Die Berechtigungen können unter{' '}
          <a href="/einstellungen" className="text-orange-600 hover:underline inline-flex items-center gap-0.5">
            Einstellungen → Rollen & Rechte <ArrowRight className="w-3 h-3" />
          </a>{' '}
          angepasst werden.
        </p>
      </div>
    </div>
  )
}
