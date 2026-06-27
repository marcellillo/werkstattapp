'use client'
import { useState, useEffect } from 'react'
import { PushSettings } from '@/components/push-settings'
import {
  Settings, Mail, Bell, Users, Database, Building2,
  CheckCircle, ExternalLink, Save, Loader2, Bot, Eye, EyeOff, Wifi, WifiOff, Receipt, Shield, QrCode as QrIcon, Download
} from 'lucide-react'
import { QrCode, downloadQr } from '@/components/ui/qr-code'
import { buildGiroCode } from '@/lib/girocode'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_BERECHTIGUNGEN, type Rolle } from '@/lib/rollen-context'

interface Config {
  imap_email: string
  imap_password: string
  graph_client_id: string
  graph_tenant_id: string
  graph_client_secret: string
  graph_email: string
  graph_refresh_token: string
  anthropic_api_key: string
  resend_api_key: string
  firma_absender_email: string
  // Firmendaten
  firma_name: string
  firma_strasse: string
  firma_plz: string
  firma_ort: string
  firma_telefon: string
  firma_email: string
  firma_ust_id: string
  firma_steuernummer: string
  firma_iban: string
  firma_bic: string
  firma_bank: string
  firma_stundensatz: string
  firma_kleinunternehmer: string
  firma_logo: string
  firma_paypal: string
  firma_sumup: string
  firma_stripe: string
}

export function EinstellungenContent({ initialConfig, profile, userEmail, urlError, urlSuccess }: {
  initialConfig: Config
  profile: any
  userEmail: string
  urlError?: string
  urlSuccess?: string
}) {
  const [config, setConfig] = useState<Config>(initialConfig)
  const [logoUploading, setLogoUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rollenBerechtigungen, setRollenBerechtigungen] = useState<Record<Rolle, string[]>>(DEFAULT_BERECHTIGUNGEN)
  const [rollenSaving, setRollenSaving] = useState(false)
  const [rollenSaved, setRollenSaved] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fehler'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showResendKey, setShowResendKey] = useState(false)
  const [resendTestStatus, setResendTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fehler'>('idle')
  const [resendTestMsg, setResendTestMsg] = useState('')
  const supabase = createClient()

  const isKonfiguriert = !!(config.imap_email && config.imap_password)
  const isGraphVerbunden = !!config.graph_refresh_token
  const isGraphKonfiguriert = !!(config.graph_client_id && config.graph_tenant_id && config.graph_client_secret)

  useEffect(() => {
    async function ladenRollen() {
      const { data } = await supabase
        .from('werkstatt_einstellungen')
        .select('wert')
        .eq('schluessel', 'rollen_berechtigungen')
        .single()
      if (data?.wert) {
        try { setRollenBerechtigungen(JSON.parse(data.wert)) } catch {}
      }
    }
    ladenRollen()
  }, [])

  async function rollenSpeichern() {
    setRollenSaving(true)
    setRollenSaved(false)
    await supabase.from('werkstatt_einstellungen').upsert(
      { schluessel: 'rollen_berechtigungen', wert: JSON.stringify(rollenBerechtigungen) },
      { onConflict: 'schluessel' }
    )
    setRollenSaving(false)
    setRollenSaved(true)
    setTimeout(() => setRollenSaved(false), 3000)
  }

  function toggleBerechtigung(rolle: Rolle, key: string) {
    setRollenBerechtigungen(prev => {
      const aktuell = prev[rolle] ?? []
      const neu = aktuell.includes(key) ? aktuell.filter(k => k !== key) : [...aktuell, key]
      return { ...prev, [rolle]: neu }
    })
  }

  async function speichern() {
    setSaving(true)
    setSaved(false)
    const eintraege = Object.entries(config).map(([schluessel, wert]) => ({ schluessel, wert: wert ?? '' }))
    for (const e of eintraege) {
      await supabase.from('werkstatt_einstellungen').upsert(e, { onConflict: 'schluessel' })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function verbindungTesten() {
    if (!isKonfiguriert) return
    setTestStatus('testing')
    setTestMsg('')
    try {
      const res = await fetch('/api/imap-test', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setTestStatus('ok')
        setTestMsg('Verbindung erfolgreich! Postfach erreichbar.')
      } else {
        setTestStatus('fehler')
        setTestMsg(data.error ?? 'Verbindung fehlgeschlagen')
      }
    } catch (e: any) {
      setTestStatus('fehler')
      setTestMsg(e.message)
    }
  }

  function logoEinlesen(file: File) {
    setLogoUploading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const maxW = 320, maxH = 120
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1)
        const w = Math.round(img.width * ratio)
        const h = Math.round(img.height * ratio)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        const base64 = canvas.toDataURL('image/png')
        setConfig(c => ({ ...c, firma_logo: base64 }))
        setLogoUploading(false)
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <p className="text-sm text-gray-800 mt-0.5">Werkstatt-Konfiguration</p>
      </div>

      {/* OAuth-Rückmeldung aus URL-Parametern */}
      {urlSuccess === 'graph_verbunden' && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800 font-medium">Microsoft-Konto erfolgreich verbunden!</p>
        </div>
      )}
      {urlError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-red-600 flex-shrink-0 mt-0.5">✕</span>
          <div>
            <p className="text-sm font-semibold text-red-800">Verbindung fehlgeschlagen</p>
            <p className="text-xs text-red-700 mt-0.5 break-all">{decodeURIComponent(urlError)}</p>
          </div>
        </div>
      )}

      {/* Firmendaten */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-5 h-5 text-orange-500" /> Firmendaten
            <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Für Rechnungen</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-800">
            Diese Daten erscheinen auf allen Rechnungen und müssen für das Finanzamt vollständig sein (§14 UStG).
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { key: 'firma_name',          label: 'Firmenname',         placeholder: 'Helios Automobile GmbH', full: true },
              { key: 'firma_strasse',        label: 'Straße & Hausnr.',   placeholder: 'Musterstraße 1' },
              { key: 'firma_plz',            label: 'PLZ',                placeholder: '44787' },
              { key: 'firma_ort',            label: 'Ort',                placeholder: 'Bochum' },
              { key: 'firma_telefon',        label: 'Telefon',            placeholder: '+49 234 12345' },
              { key: 'firma_email',          label: 'E-Mail',             placeholder: 'info@werkstatt.de' },
              { key: 'firma_ust_id',         label: 'USt-IdNr.',          placeholder: 'DE123456789' },
              { key: 'firma_steuernummer',   label: 'Steuernummer',       placeholder: '123/456/78901' },
              { key: 'firma_iban',           label: 'IBAN',               placeholder: 'DE89 3704 0044 0532 0130 00', full: true },
              { key: 'firma_bic',            label: 'BIC',                placeholder: 'COBADEFFXXX' },
              { key: 'firma_bank',           label: 'Bank',               placeholder: 'Commerzbank' },
              { key: 'firma_stundensatz',    label: 'Stundensatz (€)',    placeholder: '95' },
            ] as {key: keyof Config, label: string, placeholder: string, full?: boolean}[]).map(f => (
              <div key={f.key} className={f.full ? 'sm:col-span-2' : ''}>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{f.label}</label>
                <input
                  type="text"
                  value={config[f.key]}
                  onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.firma_kleinunternehmer === 'ja'}
                onChange={e => setConfig(c => ({ ...c, firma_kleinunternehmer: e.target.checked ? 'ja' : 'nein' }))}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-gray-700">Kleinunternehmer (§19 UStG) — keine MwSt auf Rechnungen</span>
            </label>
          </div>

          <button
            onClick={speichern}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Gespeichert!' : 'Firmendaten speichern'}
          </button>
        </CardContent>
      </Card>

      {/* Rechnungen — Logo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="w-5 h-5 text-green-600" /> Rechnungen
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Logo & Darstellung</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500">Das Logo erscheint oben links auf jeder Rechnung anstelle des Firmennamens-Textes.</p>

          {/* Vorschau */}
          {config.firma_logo ? (
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex items-center gap-4">
              <img src={config.firma_logo} alt="Logo" className="max-h-16 max-w-[200px] object-contain" />
              <div className="flex-1">
                <p className="text-xs text-green-700 font-medium">Logo gespeichert</p>
                <p className="text-xs text-gray-400 mt-0.5">Wird automatisch auf Rechnungen verwendet</p>
              </div>
              <button
                onClick={() => setConfig(c => ({ ...c, firma_logo: '' }))}
                className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg transition-colors"
              >
                Entfernen
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50">
              <p className="text-sm text-gray-500 mb-1">Kein Logo hinterlegt</p>
              <p className="text-xs text-gray-400">Firmenname wird als Text angezeigt</p>
            </div>
          )}

          {/* Upload */}
          <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${logoUploading ? 'border-gray-200 bg-gray-50 opacity-50' : 'border-green-300 hover:border-green-400 hover:bg-green-50'}`}>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={logoUploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) logoEinlesen(f) }}
            />
            {logoUploading
              ? <><Loader2 className="w-4 h-4 animate-spin text-gray-400" /><span className="text-sm text-gray-400">Wird verarbeitet...</span></>
              : <><span className="text-2xl">🖼️</span><span className="text-sm font-medium text-green-700">{config.firma_logo ? 'Anderes Logo hochladen' : 'Logo hochladen'}</span><span className="text-xs text-gray-400">PNG, JPG, SVG</span></>
            }
          </label>

          <button
            onClick={speichern}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Gespeichert!' : 'Rechnungseinstellungen speichern'}
          </button>
        </CardContent>
      </Card>

      {/* Zahlungs-QR-Code */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <QrIcon className="w-5 h-5 text-violet-600" /> Zahlungs-QR-Codes
            <span className="ml-auto text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Auf Rechnungen</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-xs text-gray-500">
            QR-Codes erscheinen auf der Rechnung. Kunden scannen einfach mit der Kamera — kein Banking-App nötig. Trage jetzt schon die Links ein, aktiviere den Dienst später.
          </p>

          {/* GiroCode / IBAN */}
          {config.firma_iban ? (() => {
            const giroValue = buildGiroCode({
              bic: config.firma_bic,
              name: config.firma_name || 'Werkstatt',
              iban: config.firma_iban,
            })
            return (
              <div className="border border-slate-200 rounded-xl p-4 flex items-center gap-5">
                <QrCode value={giroValue} size={96} className="rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900">GiroCode (SEPA-Überweisung)</p>
                  <p className="text-xs text-slate-500 mt-0.5">Funktioniert mit allen deutschen Banking-Apps (Sparkasse, DKB, ING, …)</p>
                  <p className="text-xs font-mono text-slate-400 mt-1 truncate">{config.firma_iban}</p>
                  <button
                    onClick={() => downloadQr(giroValue, 'girocode-iban.png')}
                    className="mt-2 flex items-center gap-1.5 text-xs text-violet-700 hover:text-violet-900 font-medium border border-violet-200 hover:border-violet-400 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> QR herunterladen
                  </button>
                </div>
              </div>
            )
          })() : (
            <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-500">Bitte zuerst IBAN in den Firmendaten eintragen.</p>
            </div>
          )}

          {/* Zahlungslinks */}
          <div className="space-y-3">
            {([
              { key: 'firma_paypal', label: 'PayPal.me-Link', placeholder: 'https://paypal.me/deinname', hint: 'Öffnet direkt die PayPal-App', filename: 'paypal-qr.png', color: '#0070ba' },
              { key: 'firma_sumup',  label: 'SumUp Zahlungslink', placeholder: 'https://pay.sumup.com/b2c/...', hint: 'Karte, Apple Pay, Google Pay', filename: 'sumup-qr.png', color: '#00b9ff' },
              { key: 'firma_stripe', label: 'Stripe Zahlungslink', placeholder: 'https://buy.stripe.com/...', hint: 'Karte, Apple Pay, Google Pay', filename: 'stripe-qr.png', color: '#635bff' },
            ] as { key: keyof Config; label: string; placeholder: string; hint: string; filename: string; color: string }[]).map(({ key, label, placeholder, hint, filename, color }) => (
              <div key={key} className="space-y-2">
                <label className="text-xs font-medium text-slate-700 block">{label} <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={config[key]}
                  onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                {config[key] && (
                  <div className="border border-slate-200 rounded-xl p-4 flex items-center gap-5">
                    <QrCode value={config[key]} size={88} className="rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-900">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{hint} — Kamera scannen reicht</p>
                      <p className="text-xs font-mono text-slate-400 mt-1 truncate">{config[key]}</p>
                      <button
                        onClick={() => downloadQr(config[key], filename)}
                        className="mt-2 flex items-center gap-1.5 text-xs text-violet-700 hover:text-violet-900 font-medium border border-violet-200 hover:border-violet-400 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> QR herunterladen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={speichern}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Gespeichert!' : 'Speichern'}
          </button>
        </CardContent>
      </Card>

      {/* Profil */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-blue-500" /> Benutzerprofil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-gray-50">
            <span className="text-gray-800">E-Mail</span>
            <span className="font-medium">{profile?.email ?? userEmail}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-50">
            <span className="text-gray-800">Name</span>
            <span className="font-medium">{profile?.full_name ?? '—'}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-gray-800">Rolle</span>
            <span className="font-medium capitalize">{profile?.role ?? '—'}</span>
          </div>
        </CardContent>
      </Card>

      {/* E-Mail Integration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-5 h-5 text-orange-500" />
            E-Mail-Integration (Outlook / Microsoft 365)
            {isGraphVerbunden && (
              <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Verbunden
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Status */}
          {isGraphVerbunden ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Microsoft-Konto verbunden</p>
                {config.graph_email && (
                  <p className="text-xs text-green-600 mt-0.5">{config.graph_email}</p>
                )}
                <p className="text-xs text-green-600 mt-0.5">E-Mails von Nora Zentrum & PV werden automatisch ausgelesen.</p>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">Schritt 1 von 2: Azure-Daten eintragen</p>
              <p className="text-blue-600">Trage die Werte aus dem Azure Portal ein und klicke dann auf „Mit Microsoft verbinden".</p>
            </div>
          )}

          {/* Azure Konfiguration */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Anwendungs-ID (Client ID)</label>
              <input
                type="text"
                value={config.graph_client_id}
                onChange={e => setConfig(c => ({ ...c, graph_client_id: e.target.value }))}
                placeholder="450742e8-235d-421a-a010-..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Verzeichnis-ID (Tenant ID)</label>
              <input
                type="text"
                value={config.graph_tenant_id}
                onChange={e => setConfig(c => ({ ...c, graph_tenant_id: e.target.value }))}
                placeholder="a07e1d89-5fbc-4234-..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Client Secret (Wert)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={config.graph_client_secret}
                  onChange={e => setConfig(c => ({ ...c, graph_client_secret: e.target.value }))}
                  placeholder="Das Secret aus Azure → Zertifikate & Geheimnisse"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={speichern}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? 'Gespeichert!' : 'Speichern'}
            </button>
            {isGraphKonfiguriert && (
              <a
                href="/api/graph/auth"
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Mail className="w-4 h-4" />
                {isGraphVerbunden ? 'Erneut verbinden' : 'Mit Microsoft verbinden'}
              </a>
            )}
          </div>

          {!isGraphKonfiguriert && (
            <p className="text-xs text-gray-400">Erst speichern, dann erscheint der „Mit Microsoft verbinden"-Button.</p>
          )}
        </CardContent>
      </Card>

      {/* KI-Integration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="w-5 h-5 text-purple-500" />
            KI-Integration (Rechnungen automatisch auslesen)
            <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Optional</span>
            {config.anthropic_api_key && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Aktiv
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-800">
            <p className="font-medium mb-1">Für später — wenn du bereit bist</p>
            <p>Mit einem Anthropic API Key werden PDF-Rechnungen aus E-Mails automatisch ausgelesen und als Teile eingetragen. Kosten: ca. <strong>5–50 Cent pro Monat</strong>. Ohne Key funktioniert der Rest der App ganz normal.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Anthropic API Key
              <span className="ml-1 text-gray-400 font-normal">(von platform.anthropic.com)</span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={config.anthropic_api_key}
                onChange={e => setConfig(c => ({ ...c, anthropic_api_key: e.target.value }))}
                placeholder="sk-ant-api03-••••••••••••••••••••••••"
                className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <button type="button" onClick={() => setShowApiKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              API Key holen: <a href="https://platform.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline inline-flex items-center gap-0.5">platform.anthropic.com <ExternalLink className="w-3 h-3" /></a>
            </p>
          </div>
          <button
            onClick={speichern}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Gespeichert!' : 'Speichern'}
          </button>
        </CardContent>
      </Card>

      {/* E-Mail-Versand (Resend) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-5 h-5 text-blue-500" />
            E-Mail-Versand (Rechnungen & Benachrichtigungen)
            {config.resend_api_key && (
              <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Aktiv
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">Rechnungen direkt aus der App per E-Mail versenden</p>
            <p>Mit <strong>Resend</strong> werden Rechnungen und Fertig-Benachrichtigungen automatisch an Kunden gesendet. Kostenlos bis 100 E-Mails/Monat.</p>
            <a href="https://resend.com/signup" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-blue-700 font-medium hover:underline text-xs">
              resend.com kostenlos registrieren <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Resend API Key
              <span className="ml-1 text-gray-400 font-normal">(von resend.com → API Keys)</span>
            </label>
            <div className="relative">
              <input
                type={showResendKey ? 'text' : 'password'}
                value={config.resend_api_key}
                onChange={e => setConfig(c => ({ ...c, resend_api_key: e.target.value }))}
                placeholder="re_••••••••••••••••••••••••"
                className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button type="button" onClick={() => setShowResendKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showResendKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Absender-E-Mail
              <span className="ml-1 text-gray-400 font-normal">(muss in Resend verifiziert sein)</span>
            </label>
            <input
              type="email"
              value={config.firma_absender_email}
              onChange={e => setConfig(c => ({ ...c, firma_absender_email: e.target.value }))}
              placeholder="rechnung@deinewerkstatt.de"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              Zum Testen geht auch <code className="bg-gray-100 px-1 rounded">onboarding@resend.dev</code> — dann kommt die E-Mail von Resend, nicht von dir.
            </p>
          </div>

          {resendTestStatus !== 'idle' && (
            <div className={`rounded-xl p-3 text-sm border ${resendTestStatus === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : resendTestStatus === 'fehler' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
              {resendTestStatus === 'testing' ? 'Test-E-Mail wird gesendet…' : resendTestMsg}
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={speichern}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? 'Gespeichert!' : 'Speichern'}
            </button>
            {config.resend_api_key && config.firma_absender_email && (
              <button
                onClick={async () => {
                  await speichern()
                  setResendTestStatus('testing')
                  setResendTestMsg('')
                  try {
                    const res = await fetch('/api/rechnung-email/test', { method: 'POST' })
                    const data = await res.json()
                    if (res.ok) {
                      setResendTestStatus('ok')
                      setResendTestMsg(`✓ Test-E-Mail gesendet an ${data.an}`)
                    } else {
                      setResendTestStatus('fehler')
                      setResendTestMsg(data.error ?? 'Fehler beim Senden')
                    }
                  } catch (e: any) {
                    setResendTestStatus('fehler')
                    setResendTestMsg(e.message)
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-xl text-sm font-medium transition-colors"
              >
                <Mail className="w-4 h-4" /> Test-E-Mail senden
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Domain verifizieren: <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">resend.com/domains <ExternalLink className="w-3 h-3" /></a>
          </p>
        </CardContent>
      </Card>

      {/* Benachrichtigungen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-5 h-5 text-yellow-500" /> Benachrichtigungen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PushSettings />
          <p className="text-xs text-gray-500 pt-1">Benachrichtigungen werden gesendet bei:</p>
          {[
            { label: 'Eingetroffene Ersatzteile', defaultChecked: true },
            { label: 'Auftrag überschreitet Fertigstellungstermin', defaultChecked: true },
            { label: 'Auftrag als fertig markiert', defaultChecked: true },
          ].map(item => (
            <label key={item.label} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked={item.defaultChecked} className="w-4 h-4 accent-orange-500" />
              <span className="text-sm text-gray-700">{item.label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Rollen & Rechte */}
      {profile?.role === 'admin' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5 text-indigo-500" /> Rollen & Rechte
              <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Nur Admin</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-gray-500">
              Lege fest, welche Bereiche welche Rolle sehen darf. Admin hat immer vollen Zugriff.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-700 w-40">Bereich</th>
                    {(['admin', 'werkstattmeister', 'mechaniker', 'buchhalter'] as Rolle[]).map(r => (
                      <th key={r} className="text-center py-2 px-3 text-xs font-semibold text-gray-700 capitalize">{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([
                    { key: 'dashboard',          label: 'Dashboard' },
                    { key: 'hebebuehnen',         label: 'Hebebühnen' },
                    { key: 'annahme',             label: 'Annahme' },
                    { key: 'fahrzeuge',           label: 'Fahrzeuge' },
                    { key: 'termine',             label: 'Termine' },
                    { key: 'kunden',              label: 'Kunden' },
                    { key: 'teile',               label: 'Ersatzteile' },
                    { key: 'kalender',            label: 'Kalender' },
                    { key: 'rechnungen',          label: 'Rechnungen' },
                    { key: 'buchhaltung',         label: 'Buchhaltung' },
                    { key: 'emails',              label: 'E-Mails' },
                    { key: 'verlauf',             label: 'Verlauf' },
                    { key: 'statistiken',         label: 'Statistiken' },
                    { key: 'benachrichtigungen',  label: 'Benachrichtigungen' },
                    { key: 'einstellungen',       label: 'Einstellungen' },
                  ]).map(({ key, label }) => (
                    <tr key={key} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-2.5 pr-4 text-sm text-gray-700 font-medium">{label}</td>
                      {(['admin', 'werkstattmeister', 'mechaniker', 'buchhalter'] as Rolle[]).map(rolle => {
                        const checked = (rollenBerechtigungen[rolle] ?? []).includes(key)
                        const isAdmin = rolle === 'admin'
                        return (
                          <td key={rolle} className="text-center py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isAdmin}
                              onChange={() => !isAdmin && toggleBerechtigung(rolle, key)}
                              className="w-4 h-4 accent-indigo-600 cursor-pointer disabled:cursor-default disabled:opacity-60"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={rollenSpeichern}
                disabled={rollenSaving}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {rollenSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {rollenSaved ? 'Gespeichert!' : 'Berechtigungen speichern'}
              </button>
              <button
                onClick={() => setRollenBerechtigungen(DEFAULT_BERECHTIGUNGEN)}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-xl transition-colors"
              >
                Zurücksetzen
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Datenbank */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="w-5 h-5 text-purple-500" /> Datenbank
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Führe das Skript <code className="bg-gray-100 px-1 rounded text-xs">supabase/werkstatt-update-v4.sql</code> im
            Supabase SQL-Editor aus, um die Einstellungs-Tabelle für die E-Mail-Integration anzulegen.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
