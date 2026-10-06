'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, CheckCircle, AlertCircle, Loader2, RefreshCw, KeyRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface GraphStatus {
  clientId: string
  tenantId: string
  hatSecret: boolean
  verbunden: boolean
  email: string
  aktiv: boolean
  letzterSync: string | null
  fehler: string
}

function fmtZeit(iso: string | null) {
  if (!iso) return 'noch nie'
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const inputKlasse = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

// Verbindung zum Firmen-Postfach (Microsoft 365) für den Rechnungs-Import.
export function MicrosoftPostfachCard({ status }: { status: GraphStatus }) {
  const router = useRouter()
  const [clientId, setClientId] = useState(status.clientId)
  const [tenantId, setTenantId] = useState(status.tenantId)
  const [secret, setSecret] = useState('')
  const [zugangsdatenOffen, setZugangsdatenOffen] = useState(!status.clientId || !status.tenantId || !status.hatSecret)
  const [speichert, setSpeichert] = useState(false)
  const [prueft, setPrueft] = useState(false)
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)

  // Rückmeldung nach der Microsoft-Anmeldung (?success=graph_verbunden / ?error=...)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('success') === 'graph_verbunden') setMeldung({ art: 'ok', text: 'Postfach verbunden. Die Rechnungen werden jetzt automatisch abgeholt.' })
    else if (p.get('error')) setMeldung({ art: 'fehler', text: p.get('error')! })
  }, [])

  async function zugangsdatenSpeichern() {
    setSpeichert(true); setMeldung(null)
    try {
      const res = await fetch('/api/graph/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, tenantId, clientSecret: secret }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Speichern fehlgeschlagen')
      setSecret(''); setZugangsdatenOffen(false)
      setMeldung({ art: 'ok', text: 'Zugangsdaten gespeichert. Jetzt mit Microsoft verbinden.' })
      router.refresh()
    } catch (e: any) { setMeldung({ art: 'fehler', text: e.message }) }
    finally { setSpeichert(false) }
  }

  async function automatikUmschalten(aktiv: boolean) {
    setMeldung(null)
    const res = await fetch('/api/graph/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktiv }),
    })
    if (!res.ok) { setMeldung({ art: 'fehler', text: (await res.json()).error ?? 'Speichern fehlgeschlagen' }); return }
    router.refresh()
  }

  async function jetztPruefen() {
    setPrueft(true); setMeldung(null)
    try {
      const res = await fetch('/api/email-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tage: 90 }) })
      const data = await res.json()
      if (!res.ok || !data.erfolg) throw new Error(data.error ?? 'Abruf fehlgeschlagen')
      const text = `${data.emailsGeprueft} E-Mails geprüft – ${data.rechnungenImportiert} Rechnung(en) importiert` +
        (data.duplikate ? `, ${data.duplikate} bereits vorhanden` : '') +
        (data.verbleibend ? `. ${data.verbleibend} weitere noch offen – bitte unter „Rechnungen“ erneut prüfen.` : '.')
      setMeldung({ art: 'ok', text })
      router.refresh()
    } catch (e: any) { setMeldung({ art: 'fehler', text: e.message }) }
    finally { setPrueft(false) }
  }

  const zugangsdatenVollstaendig = !!status.clientId && !!status.tenantId && status.hatSecret

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-red-600" /> E-Mail-Postfach (Microsoft)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Rechnungen, die per E-Mail im Postfach eingehen, werden automatisch ausgelesen und samt PDF
          unter „Rechnungen“ abgelegt. Dort markierst du sie als offen oder bezahlt.
        </p>

        {status.fehler && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span>{status.fehler}</span>
          </div>
        )}

        {status.verbunden && !status.fehler ? (
          <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Verbunden{status.email ? ` mit ${status.email}` : ''}</p>
              <p className="text-green-700">Letzter Abruf: {fmtZeit(status.letzterSync)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {zugangsdatenVollstaendig ? 'Noch nicht verbunden.' : 'Zuerst die Azure-Zugangsdaten eintragen, danach mit Microsoft anmelden.'}
          </p>
        )}

        {zugangsdatenOffen && (
          <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <label className="text-sm font-medium text-slate-900 mb-1 block">Anwendungs-ID (Client-ID)</label>
              <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className={inputKlasse} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-900 mb-1 block">Verzeichnis-ID (Tenant-ID)</label>
              <input value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className={inputKlasse} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-900 mb-1 block">Client-Secret</label>
              <input type="password" value={secret} onChange={e => setSecret(e.target.value)} autoComplete="off"
                placeholder={status.hatSecret ? '•••••••• (gespeichert – nur zum Ersetzen ausfüllen)' : 'Wert des Client-Secrets'} className={inputKlasse} />
            </div>
            <button onClick={zugangsdatenSpeichern} disabled={speichert || !clientId || !tenantId || (!secret && !status.hatSecret)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {speichert ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Zugangsdaten speichern
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {zugangsdatenVollstaendig && (
            <a href="/api/graph/auth"
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">
              <Mail className="w-4 h-4" /> {status.verbunden ? 'Neu mit Microsoft verbinden' : 'Mit Microsoft verbinden'}
            </a>
          )}
          {status.verbunden && (
            <button onClick={jetztPruefen} disabled={prueft}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-medium disabled:opacity-50">
              {prueft ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Jetzt prüfen (letzte 90 Tage)
            </button>
          )}
          {!zugangsdatenOffen && (
            <button onClick={() => setZugangsdatenOffen(true)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 underline">
              Zugangsdaten ändern
            </button>
          )}
        </div>

        {status.verbunden && (
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={status.aktiv} onChange={e => automatikUmschalten(e.target.checked)} className="w-4 h-4 accent-red-600" />
            Automatisch abrufen (täglich und beim Öffnen der Rechnungsseite)
          </label>
        )}

        {meldung && (
          <div className={`p-3 rounded-lg text-sm ${meldung.art === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {meldung.text}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
