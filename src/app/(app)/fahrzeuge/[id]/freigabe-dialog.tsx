'use client'
// Link zur Kunden-Freigabe des Kostenvoranschlags erzeugen und verschicken (WhatsApp, E-Mail, Teilen, Kopieren).
import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, Mail, MessageCircle, Share2, X } from 'lucide-react'
import { waNummer } from '@/lib/kontakt'

interface Props {
  kostenvoranschlagId: string
  kunde?: { vorname?: string | null; nachname?: string | null; mobil?: string | null; telefon?: string | null; email?: string | null } | null
  fahrzeugName: string
  firmaName: string
  onClose: () => void
  onGesendet: () => void
}

export function FreigabeDialog({ kostenvoranschlagId, kunde, fahrzeugName, firmaName, onClose, onGesendet }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [kopiert, setKopiert] = useState(false)

  useEffect(() => {
    let aktiv = true
    ;(async () => {
      try {
        const res = await fetch('/api/kostenvoranschlag/freigabe-link', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kostenvoranschlagId }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(d.error || 'Der Link konnte nicht erstellt werden.')
        if (aktiv) { setUrl(d.url); onGesendet() }
      } catch (e: any) {
        if (aktiv) setFehler(e?.message ?? 'Der Link konnte nicht erstellt werden.')
      }
    })()
    return () => { aktiv = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kostenvoranschlagId])

  const anrede = [kunde?.vorname, kunde?.nachname].filter(Boolean).join(' ')
  const nachricht = url
    ? `Guten Tag${anrede ? ' ' + anrede : ''}, hier ist Ihr Kostenvoranschlag für Ihren ${fahrzeugName || 'Wagen'} von ${firmaName || 'Ihrer Werkstatt'}: ${url}\nBitte kurz ansehen und freigeben – dann legen wir direkt los. Vielen Dank!`
    : ''
  const nummer = waNummer(kunde?.mobil) || waNummer(kunde?.telefon)
  const waLink = url ? `https://wa.me/${nummer}?text=${encodeURIComponent(nachricht)}` : '#'
  const mailLink = url ? `mailto:${kunde?.email ?? ''}?subject=${encodeURIComponent('Ihr Kostenvoranschlag – ' + (fahrzeugName || firmaName))}&body=${encodeURIComponent(nachricht)}` : '#'

  async function kopieren() {
    try { await navigator.clipboard.writeText(url!); setKopiert(true); setTimeout(() => setKopiert(false), 2500) } catch { /* Zwischenablage nicht erlaubt */ }
  }
  const kannTeilen = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={e => e.stopPropagation()} role="dialog" aria-label="Kostenvoranschlag zur Freigabe senden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="font-semibold text-slate-900">Zur Freigabe an den Kunden senden</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Schließen"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {!url && !fehler && <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Link wird erstellt …</p>}
          {fehler && <p className="text-sm text-red-600">{fehler}</p>}
          {url && (
            <>
              <p className="text-sm text-slate-600">Der Kunde sieht den Kostenvoranschlag und kann ihn <strong>ohne Anmeldung</strong> freigeben oder eine Rückfrage stellen. Sie werden benachrichtigt.</p>
              <div className="flex gap-2">
                <input readOnly value={url} onFocus={e => e.currentTarget.select()} className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 bg-slate-50" aria-label="Freigabe-Link" />
                <button onClick={kopieren} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm inline-flex items-center gap-1.5">
                  {kopiert ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}{kopiert ? 'Kopiert' : 'Kopieren'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 text-sm">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
                <a href={mailLink} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-medium py-3 text-sm">
                  <Mail className="w-4 h-4" /> E-Mail
                </a>
              </div>
              {kannTeilen && (
                <button onClick={() => navigator.share({ title: 'Kostenvoranschlag', text: nachricht }).catch(() => {})} className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 py-2.5 text-sm text-slate-700">
                  <Share2 className="w-4 h-4" /> Anders teilen …
                </button>
              )}
              {!nummer && <p className="text-xs text-slate-400">Beim Kunden ist keine Handynummer hinterlegt — in WhatsApp den Kontakt auswählen.</p>}
              <p className="text-xs text-slate-400">Hinweis: WhatsApp öffnet sich auf diesem Gerät — der Absender ist die Nummer, mit der dieses Gerät bei WhatsApp angemeldet ist (am besten WhatsApp Business mit der Firmennummer).</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
