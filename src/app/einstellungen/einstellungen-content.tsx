'use client'
import { useState, useEffect } from 'react'
import {
  Settings, Mail, Bell, Users, Database, Building2,
  CheckCircle, ExternalLink, Save, Loader2, Bot, Eye, EyeOff, Wifi, WifiOff, Receipt, Shield, QrCode as QrIcon, Download
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

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

export function EinstellungenContent({ initialConfig, betriebName, betriebId }: {
  initialConfig: Config
  betriebName: string
  betriebId: string
}) {
  const [config, setConfig] = useState<Config>(initialConfig)
  const [logoUploading, setLogoUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fehler'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showResendKey, setShowResendKey] = useState(false)
  const supabase = createClient()

  const isKonfiguriert = !!(config.imap_email && config.imap_password)

  async function speichern() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/betrieb-settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betriebId, config }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Fehler beim Speichern')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error: any) {
      console.error('Save error:', error)
      alert(`Fehler: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function verbindungTesten() {
    if (!isKonfiguriert) return
    setTestStatus('testing')
    setTestMsg('')
    try {
      const res = await fetch('/api/imap-test', { method: 'POST', body: JSON.stringify(config) })
      const data = await res.json()
      if (res.ok && data.ok) {
        setTestStatus('ok')
        setTestMsg('Verbindung erfolgreich!')
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
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">⚙️ Einstellungen</h1>
        <p className="text-slate-600 mt-1">{betriebName}</p>
      </div>

      {/* Firmendaten */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-500" /> Firmendaten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-800">
            Diese Daten erscheinen auf allen Rechnungen und müssen für das Finanzamt vollständig sein.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <label className="text-sm font-medium text-slate-700 mb-1 block">{f.label}</label>
                <input
                  type="text"
                  value={config[f.key]}
                  onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="kleinunternehmer"
              checked={config.firma_kleinunternehmer === 'ja'}
              onChange={e => setConfig(c => ({ ...c, firma_kleinunternehmer: e.target.checked ? 'ja' : 'nein' }))}
              className="w-4 h-4"
            />
            <label htmlFor="kleinunternehmer" className="text-sm text-slate-700">
              Kleinunternehmer (§19 UStG) — keine MwSt auf Rechnungen
            </label>
          </div>

          <button
            onClick={speichern}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Gespeichert!' : 'Speichern'}
          </button>
        </CardContent>
      </Card>

      {/* Rechnungslogo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-green-600" /> Rechnungslogo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">Das Logo erscheint oben auf jeder Rechnung.</p>

          {config.firma_logo ? (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex items-center gap-4">
              <img src={config.firma_logo} alt="Logo" className="max-h-16 max-w-[200px] object-contain" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-700">Logo gespeichert</p>
                <p className="text-xs text-slate-500 mt-0.5">Wird auf Rechnungen verwendet</p>
              </div>
              <button
                onClick={() => setConfig(c => ({ ...c, firma_logo: '' }))}
                className="text-xs text-red-600 hover:text-red-700 border border-red-200 px-2 py-1 rounded transition"
              >
                Entfernen
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50">
              <p className="text-sm text-slate-500">Kein Logo hinterlegt</p>
            </div>
          )}

          <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-green-300 hover:border-green-400 hover:bg-green-50 rounded-lg cursor-pointer transition">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={logoUploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) logoEinlesen(f) }}
            />
            {logoUploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Wird verarbeitet...</span></>
              : <><span className="text-2xl">🖼️</span><span className="text-sm font-medium text-green-700">Logo hochladen</span></>
            }
          </label>

          <button
            onClick={speichern}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Gespeichert!' : 'Speichern'}
          </button>
        </CardContent>
      </Card>

      {/* Zahlungsmethoden */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-600" /> Zahlungsmethoden
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">Verbinden Sie Zahlungsanbieter für Rechnungen.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              { key: 'firma_stripe', label: 'Stripe', icon: '💳' },
              { key: 'firma_paypal', label: 'PayPal', icon: '🅿️' },
              { key: 'firma_sumup', label: 'SumUp', icon: '📱' },
            ] as {key: keyof Config, label: string, icon: string}[]).map(m => (
              <div key={m.key} className="border border-slate-200 rounded-lg p-4">
                <div className="text-3xl mb-2">{m.icon}</div>
                <p className="font-medium text-sm mb-3">{m.label}</p>
                <input
                  type="text"
                  placeholder="API-Key oder Benutzername"
                  value={config[m.key]}
                  onChange={e => setConfig(c => ({ ...c, [m.key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>

          <button
            onClick={speichern}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Gespeichert!' : 'Speichern'}
          </button>
        </CardContent>
      </Card>

      {/* API-Integrationen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-600" /> API-Integrationen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">Verbinden Sie externe Services.</p>

          <div className="space-y-4">
            {([
              { key: 'anthropic_api_key', label: 'Anthropic API Key', icon: '🤖' },
              { key: 'resend_api_key', label: 'Resend API Key (Emails)', icon: '📧' },
            ] as {key: keyof Config, label: string, icon: string}[]).map(api => (
              <div key={api.key} className="border border-slate-200 rounded-lg p-4">
                <label className="text-sm font-medium text-slate-900 mb-2 block">{api.icon} {api.label}</label>
                <div className="relative">
                  <input
                    type={api.key.includes('password') || api.key.includes('key') ? (api.key === 'anthropic_api_key' ? (showApiKey ? 'text' : 'password') : (showResendKey ? 'text' : 'password')) : 'text'}
                    value={config[api.key]}
                    onChange={e => setConfig(c => ({ ...c, [api.key]: e.target.value }))}
                    placeholder={`Geben Sie Ihren ${api.label} ein`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                  />
                  {api.key === 'anthropic_api_key' && (
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                    >
                      {showApiKey ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  )}
                  {api.key === 'resend_api_key' && (
                    <button
                      onClick={() => setShowResendKey(!showResendKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                    >
                      {showResendKey ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={speichern}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Gespeichert!' : 'Speichern'}
          </button>
        </CardContent>
      </Card>

      {/* Email-Sync */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-red-600" /> Email-Synchronisation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">Verbinden Sie Ihr Email-Postfach für automatische Synchro.</p>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-900 mb-1 block">Email-Adresse</label>
              <input
                type="email"
                value={config.imap_email}
                onChange={e => setConfig(c => ({ ...c, imap_email: e.target.value }))}
                placeholder="your@email.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-900 mb-1 block">Passwort</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={config.imap_password}
                  onChange={e => setConfig(c => ({ ...c, imap_password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 pr-10"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                >
                  {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={verbindungTesten}
            disabled={!isKonfiguriert || testStatus === 'testing'}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {testStatus === 'testing' ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Wird getestet...</>
            ) : testStatus === 'ok' ? (
              <><CheckCircle className="w-4 h-4 text-green-600" />Verbunden</>
            ) : testStatus === 'fehler' ? (
              <><WifiOff className="w-4 h-4 text-red-600" />Fehler</>
            ) : (
              <><Wifi className="w-4 h-4" />Verbindung testen</>
            )}
          </button>

          {testMsg && (
            <div className={`p-3 rounded-lg text-sm ${testStatus === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {testMsg}
            </div>
          )}

          <button
            onClick={speichern}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Gespeichert!' : 'Speichern'}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
