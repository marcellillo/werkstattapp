import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Car, CheckCircle, Clock, Wrench, Package, Truck, ShieldCheck, Ban } from 'lucide-react'

const STATUS_INFO: Record<string, { label: string; icon: typeof Clock; color: string; bg: string; desc: string }> = {
  angenommen:   { label: 'Angenommen',        icon: CheckCircle, color: 'text-blue-600',   bg: 'bg-blue-100',   desc: 'Ihr Fahrzeug wurde aufgenommen und wird geprüft.' },
  diagnose:     { label: 'Diagnose',           icon: Wrench,      color: 'text-purple-600', bg: 'bg-purple-100', desc: 'Unser Team führt eine Diagnose durch.' },
  reparatur:    { label: 'In Reparatur',       icon: Wrench,      color: 'text-orange-600', bg: 'bg-orange-100', desc: 'Die Reparaturarbeiten laufen.' },
  warten_teile: { label: 'Warte auf Teile',    icon: Package,     color: 'text-yellow-600', bg: 'bg-yellow-100', desc: 'Wir warten auf Ersatzteile.' },
  fertig:       { label: 'Fertig zur Abholung',icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-100',  desc: 'Ihr Fahrzeug ist fertig – Sie können es abholen!' },
  ausgeliefert: { label: 'Ausgeliefert',       icon: Truck,       color: 'text-gray-600',   bg: 'bg-gray-100',   desc: 'Das Fahrzeug wurde übergeben.' },
  storniert:    { label: 'Storniert',          icon: Ban,         color: 'text-red-600',    bg: 'bg-red-100',    desc: 'Dieser Auftrag wurde storniert.' },
}

const STATUS_ORDER = ['angenommen', 'diagnose', 'reparatur', 'warten_teile', 'fertig', 'ausgeliefert']

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function StatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: auftrag }, { data: cfgRows }] = await Promise.all([
    supabase
      .from('auftraege')
      .select('*, fahrzeug:fahrzeuge(marke, modell, kennzeichen, baujahr), kunde:kunden(vorname, nachname)')
      .eq('id', id)
      .single(),
    supabase
      .from('werkstatt_einstellungen')
      .select('schluessel, wert')
      .in('schluessel', ['firma_name', 'firma_strasse', 'firma_plz', 'firma_ort', 'firma_telefon', 'firma_email']),
  ])

  if (!auftrag) notFound()

  const cfg: Record<string, string> = {}
  for (const r of cfgRows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  const fz = auftrag.fahrzeug as any
  const kunde = auftrag.kunde as any
  const statusInfo = STATUS_INFO[auftrag.status] ?? STATUS_INFO.angenommen
  const StatusIcon = statusInfo.icon
  const currentIdx = STATUS_ORDER.indexOf(auftrag.status)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <Car className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Helios Automobile GmbH</p>
            <p className="text-xs text-gray-500">Auftragsstatus · {auftrag.auftrag_nr ?? id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6">
        <div className="max-w-lg mx-auto space-y-5">
          {/* Status Card */}
          <div className={`rounded-2xl p-5 border-2 ${statusInfo.bg} border-opacity-50`} style={{ borderColor: 'transparent' }}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl ${statusInfo.bg} flex items-center justify-center flex-shrink-0`}>
                <StatusIcon className={`w-7 h-7 ${statusInfo.color}`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktueller Status</p>
                <p className={`text-xl font-bold ${statusInfo.color}`}>{statusInfo.label}</p>
                <p className="text-sm text-gray-600 mt-0.5">{statusInfo.desc}</p>
              </div>
            </div>
          </div>

          {/* Fahrzeug Info */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 text-sm">Fahrzeug</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {fz && <>
                <div>
                  <p className="text-xs text-gray-500">Fahrzeug</p>
                  <p className="font-medium text-gray-900">{fz.marke} {fz.modell}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Kennzeichen</p>
                  <p className="font-medium text-gray-900">{fz.kennzeichen}</p>
                </div>
                {fz.baujahr && <div>
                  <p className="text-xs text-gray-500">Baujahr</p>
                  <p className="font-medium text-gray-900">{fz.baujahr}</p>
                </div>}
              </>}
              {kunde && <div>
                <p className="text-xs text-gray-500">Kunde</p>
                <p className="font-medium text-gray-900">{kunde.vorname} {kunde.nachname}</p>
              </div>}
            </div>
            {auftrag.arbeiten && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Durchzuführende Arbeiten</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{auftrag.arbeiten}</p>
              </div>
            )}
            {auftrag.geplante_fertigstellung && (
              <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Geplante Fertigstellung</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(auftrag.geplante_fertigstellung + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Fortschritt */}
          {auftrag.status !== 'storniert' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-4">Fortschritt</h2>
              <div className="space-y-3">
                {STATUS_ORDER.map((s, i) => {
                  const info = STATUS_INFO[s]
                  const Icon = info.icon
                  const done = i < currentIdx
                  const active = i === currentIdx
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        done ? 'bg-green-100' : active ? info.bg : 'bg-gray-100'
                      }`}>
                        {done
                          ? <CheckCircle className="w-4 h-4 text-green-600" />
                          : <Icon className={`w-4 h-4 ${active ? info.color : 'text-gray-300'}`} />
                        }
                      </div>
                      <span className={`text-sm ${active ? 'font-semibold ' + info.color : done ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                        {info.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Kontakt */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Kontakt</h2>
            <div className="space-y-2 text-sm text-gray-700">
              {(cfg.firma_strasse || cfg.firma_ort) && (
                <p>📍 {[cfg.firma_strasse, [cfg.firma_plz, cfg.firma_ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
              )}
              {cfg.firma_telefon && (
                <p>📞 <a href={`tel:${cfg.firma_telefon.replace(/\s/g,'')}`} className="text-orange-600 hover:underline">{cfg.firma_telefon}</a></p>
              )}
              {cfg.firma_email && (
                <p>✉️ <a href={`mailto:${cfg.firma_email}`} className="text-orange-600 hover:underline">{cfg.firma_email}</a></p>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 pb-4">Diese Seite wird automatisch aktualisiert wenn sich der Status ändert.</p>
        </div>
      </div>
    </div>
  )
}
