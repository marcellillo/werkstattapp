'use client'
import { useState } from 'react'
import {
  Settings, Mail, Bell, Users, Database, Building2,
  CheckCircle, ExternalLink, Save, Loader2, Bot, Eye, EyeOff, Wifi, WifiOff, Receipt
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

interface Config {
  imap_email: string
  imap_password: string
  anthropic_api_key: string
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
}

export function EinstellungenContent({ initialConfig, profile, userEmail }: {
  initialConfig: Config
  profile: any
  userEmail: string
}) {
  const [config, setConfig] = useState<Config>(initialConfig)
  const [logoUploading, setLogoUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fehler'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const supabase = createClient()

  const isKonfiguriert = !!(config.imap_email && config.imap_password)

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
            {isKonfiguriert && (
              <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Konfiguriert
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {!isKonfiguriert && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
              <p className="font-medium mb-1">Postfach verknüpfen</p>
              <p>Gib deine Outlook-Adresse und ein App-Passwort ein. Die App liest dann automatisch Bestell- und Lieferbestätigungen ein.</p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">E-Mail-Adresse</label>
              <input
                type="email"
                value={config.imap_email}
                onChange={e => setConfig(c => ({ ...c, imap_email: e.target.value }))}
                placeholder="werkstatt@heliosautomobile.de"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                App-Passwort
                <span className="ml-1 text-gray-400 font-normal">(nicht dein normales Passwort!)</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={config.imap_password}
                  onChange={e => setConfig(c => ({ ...c, imap_password: e.target.value }))}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Anleitung App-Passwort */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 space-y-2">
            <p className="font-medium text-gray-900">App-Passwort erstellen (einmalig, 2 Minuten)</p>
            <ol className="space-y-1 text-gray-600 list-decimal list-inside">
              <li>Öffne <a href="https://account.microsoft.com/security" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline inline-flex items-center gap-0.5">account.microsoft.com/security <ExternalLink className="w-3 h-3" /></a></li>
              <li>Melde dich mit deinem Microsoft-Konto an</li>
              <li>Klicke auf <strong>„Erweiterte Sicherheitsoptionen"</strong></li>
              <li>Unter App-Kennwörter: <strong>„Neues App-Kennwort erstellen"</strong></li>
              <li>Name: „Werkstatt Manager" → Passwort kopieren und hier eintragen</li>
            </ol>
            <p className="text-xs text-gray-500 mt-1">Außerdem: In Outlook → Einstellungen → IMAP aktivieren (falls noch nicht an)</p>
          </div>

          {/* Speichern + Testen */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={speichern}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? 'Gespeichert!' : 'Speichern'}
            </button>
            {isKonfiguriert && (
              <button
                onClick={verbindungTesten}
                disabled={testStatus === 'testing'}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 hover:border-orange-300 text-gray-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {testStatus === 'testing'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : testStatus === 'ok'
                  ? <Wifi className="w-4 h-4 text-green-500" />
                  : testStatus === 'fehler'
                  ? <WifiOff className="w-4 h-4 text-red-500" />
                  : <Wifi className="w-4 h-4" />}
                Verbindung testen
              </button>
            )}
          </div>

          {testStatus === 'ok' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{testMsg}</span>
            </div>
          )}
          {testStatus === 'fehler' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
              <p className="font-medium mb-0.5">Verbindungsfehler</p>
              <p className="font-mono text-xs">{testMsg}</p>
            </div>
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

      {/* Benachrichtigungen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-5 h-5 text-yellow-500" /> Benachrichtigungen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Benachrichtigung bei eingetroffenen Teilen', defaultChecked: true },
            { label: 'Benachrichtigung bei überschrittenem Fertigstellungstermin', defaultChecked: true },
            { label: 'Fahrzeug länger als X Tage auf Bühne', defaultChecked: true },
          ].map(item => (
            <label key={item.label} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked={item.defaultChecked} className="w-4 h-4 accent-orange-500" />
              <span className="text-sm text-gray-700">{item.label}</span>
            </label>
          ))}
          <div>
            <label className="text-xs text-gray-800 mb-1 block">Warnung nach X Tagen auf Bühne</label>
            <input type="number" defaultValue={5} min={1}
              className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </CardContent>
      </Card>

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
