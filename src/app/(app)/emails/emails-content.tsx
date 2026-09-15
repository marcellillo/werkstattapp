'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Mail, Package, CheckCircle, Truck, AlertCircle, Car,
  RefreshCw, Settings, Loader2, ArrowRight, X
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDateTime } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { icon: typeof Mail; color: string; label: string }> = {
  geliefert: { icon: CheckCircle, color: 'text-green-600', label: 'Geliefert' },
  unterwegs: { icon: Truck, color: 'text-yellow-600', label: 'Unterwegs' },
  bestellt: { icon: Package, color: 'text-orange-600', label: 'Bestellt' },
}

const STATUS_BADGE: Record<string, string> = {
  geliefert: 'bg-green-100 text-green-700',
  unterwegs: 'bg-yellow-100 text-yellow-700',
  bestellt: 'bg-orange-100 text-orange-700',
}

export function EmailsContent({ emails, istKonfiguriert, letzterSync, teileUpdates: initialTeileUpdates }: {
  emails: any[]
  istKonfiguriert: boolean
  letzterSync: string | null
  teileUpdates: any[]
}) {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [lokalEmails, setLokalEmails] = useState(emails)
  const [teileUpdates, setTeileUpdates] = useState<any[]>(initialTeileUpdates)
  const [bestaetigenLoading, setBestaetigenLoading] = useState<string | null>(null)

  async function handleTeileAktion(id: string, aktion: 'bestaetigen' | 'ablehnen') {
    setBestaetigenLoading(id)
    try {
      await fetch('/api/teile-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, aktion }),
      })
      setTeileUpdates(prev => prev.filter(u => u.id !== id))
    } finally {
      setBestaetigenLoading(null)
    }
  }

  async function syncStarten() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/email-sync', { method: 'POST' })
      const data = await res.json()
      setSyncResult({ ok: res.ok, ...data })
      // Seite neu laden um neue E-Mails zu zeigen
      if (res.ok) window.location.reload()
    } catch (e: any) {
      setSyncResult({ ok: false, error: e.message })
    } finally {
      setSyncing(false)
    }
  }

  const verarbeitet = lokalEmails.filter(e => e.verarbeitet)
  const unverarbeitet = lokalEmails.filter(e => !e.verarbeitet)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Mail-Protokoll</h1>
          <p className="text-sm text-gray-800 mt-0.5">
            Automatische Überwachung für Lieferbestätigungen von PV Automotive, Nora &amp; eBay
          </p>
        </div>
        {istKonfiguriert ? (
          <button
            onClick={syncStarten}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60 flex-shrink-0"
          >
            {syncing
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
          </button>
        ) : (
          <Link href="/einstellungen">
            <button className="flex items-center gap-2 px-4 py-2.5 border border-orange-200 text-orange-600 rounded-xl text-sm font-medium hover:bg-orange-50 transition-colors flex-shrink-0">
              <Settings className="w-4 h-4" /> Einrichten
            </button>
          </Link>
        )}
      </div>

      {/* Sync-Ergebnis */}
      {syncResult && (
        <div className={cn(
          'rounded-xl p-4 border text-sm',
          syncResult.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        )}>
          {syncResult.ok ? (
            <div>
              <p className="font-medium mb-1">Synchronisation abgeschlossen</p>
              <p>{syncResult.emailsGeprueft} E-Mails geprüft · {syncResult.neuErstellt} Teile neu erstellt · {syncResult.statusAktualisiert} Status aktualisiert</p>
              {syncResult.fehler?.length > 0 && (
                <p className="mt-1 text-orange-700">Hinweise: {syncResult.fehler.join(', ')}</p>
              )}
            </div>
          ) : (
            <div>
              <p className="font-medium mb-0.5">Fehler bei der Synchronisation</p>
              <p className="font-mono text-xs">{syncResult.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Teile-Erkennungen Bestätigung */}
      {teileUpdates.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-500" />
            {teileUpdates.length} Teile-Erkennung{teileUpdates.length !== 1 ? 'en' : ''} warten auf Bestätigung
          </h2>
          {teileUpdates.map(update => (
            <Card key={update.id} className="border-orange-200">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{update.lieferant}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_BADGE[update.neuer_status] ?? 'bg-gray-100 text-gray-600')}>
                        {update.neuer_status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{update.betreff}</p>
                    {update.fahrzeug_label && (
                      <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                        <Car className="w-3.5 h-3.5" />{update.fahrzeug_label}
                      </p>
                    )}
                    {!update.auftrag_id && (
                      <p className="text-xs text-amber-600 mt-1">⚠ Kein Auftrag gefunden — Teile werden neu angelegt wenn bestätigt</p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
                  {update.teile.map((teil: any, i: number) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 font-medium">{teil.bezeichnung}</p>
                        {teil.teilenummer && <p className="text-xs font-mono text-gray-400">{teil.teilenummer}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-500">{teil.menge}x</p>
                        {teil.einzelpreis && <p className="text-xs font-semibold text-gray-700">{teil.einzelpreis.toFixed(2)} €</p>}
                        {teil.vorhanden_id
                          ? <p className="text-xs text-blue-600">im Auftrag ✓</p>
                          : <p className="text-xs text-gray-400">neu</p>
                        }
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleTeileAktion(update.id, 'bestaetigen')}
                    disabled={bestaetigenLoading === update.id}
                    className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                  >
                    {bestaetigenLoading === update.id ? 'Wird übernommen...' : `✓ ${update.teile.length} Teile übernehmen`}
                  </button>
                  <button
                    onClick={() => handleTeileAktion(update.id, 'ablehnen')}
                    disabled={bestaetigenLoading === update.id}
                    className="px-3 py-2 border border-gray-200 text-gray-500 hover:text-gray-700 text-sm rounded-lg transition-colors disabled:opacity-60"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Nicht konfiguriert Banner */}
      {!istKonfiguriert && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-blue-800 text-sm">Microsoft 365 noch nicht verbunden</p>
            <p className="text-sm text-blue-600 mt-1">
              Richte die Verbindung zu <strong>werkstatt@heliosautomobile.de</strong> ein — die App liest dann automatisch alle Bestell- und Lieferbestätigungen ein.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['📦 Bestellung → Bestellt', '🚚 Versand → Unterwegs', '✅ Lieferung → Geliefert'].map(t => (
                <span key={t} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{t}</span>
              ))}
            </div>
            <Link href="/einstellungen" className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-blue-700 hover:text-blue-800">
              Zu den Einstellungen <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Letzter Sync */}
      {letzterSync && (
        <p className="text-xs text-gray-500">Letzter Sync: {formatDateTime(letzterSync)}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{lokalEmails.length}</p>
            <p className="text-xs text-gray-800 mt-1">E-Mails gesamt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{verarbeitet.length}</p>
            <p className="text-xs text-gray-800 mt-1">Verarbeitet</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{unverarbeitet.length}</p>
            <p className="text-xs text-gray-800 mt-1">Ausstehend</p>
          </CardContent>
        </Card>
      </div>

      {/* E-Mail Liste */}
      {lokalEmails.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-800">Noch keine E-Mails synchronisiert</p>
            {istKonfiguriert && (
              <button onClick={syncStarten} className="mt-3 text-sm text-orange-600 hover:text-orange-700 font-medium">
                Jetzt synchronisieren
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {lokalEmails.map(email => {
            const statusCfg = email.erkannter_status ? STATUS_CONFIG[email.erkannter_status] : null
            return (
              <Card key={email.id} className={cn(!email.verarbeitet && 'border-orange-200 bg-orange-50/20')}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                      email.verarbeitet ? 'bg-green-100' : 'bg-orange-100'
                    )}>
                      <Mail className={cn('w-4 h-4', email.verarbeitet ? 'text-green-600' : 'text-orange-600')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium text-sm text-gray-900 truncate">{email.betreff ?? 'Kein Betreff'}</p>
                        <span className="text-xs text-gray-600 flex-shrink-0">{formatDateTime(email.empfangen_am)}</span>
                      </div>
                      <p className="text-xs text-gray-800">Von: {email.absender ?? 'Unbekannt'}</p>
                      {email.inhalt && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{email.inhalt}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {statusCfg && (
                          <span className={cn('flex items-center gap-1 text-xs font-medium', statusCfg.color)}>
                            <statusCfg.icon className="w-3.5 h-3.5" />
                            {statusCfg.label} erkannt
                          </span>
                        )}
                        {email.auftrag?.fahrzeug && (
                          <span className="flex items-center gap-1 text-xs text-gray-800">
                            <Car className="w-3.5 h-3.5" />
                            {email.auftrag.fahrzeug.marke} {email.auftrag.fahrzeug.modell}
                            ({email.auftrag.fahrzeug.kennzeichen})
                          </span>
                        )}
                        {email.verarbeitet ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3.5 h-3.5" /> Verarbeitet
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-orange-600">
                            <AlertCircle className="w-3.5 h-3.5" /> Ausstehend
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
