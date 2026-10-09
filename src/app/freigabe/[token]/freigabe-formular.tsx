'use client'
import { useState } from 'react'
import { Check, Loader2, MessageCircle } from 'lucide-react'

interface Props {
  token: string
  freigegeben: boolean
  freigegebenAm: string | null
  freigegebenName: string | null
  rueckfrageGesendet: boolean
}

export function FreigabeFormular({ token, freigegeben: schonFrei, freigegebenAm, freigegebenName, rueckfrageGesendet }: Props) {
  const [name, setName] = useState('')
  const [nachricht, setNachricht] = useState('')
  const [rueckfrageOffen, setRueckfrageOffen] = useState(false)
  const [laedt, setLaedt] = useState<'freigeben' | 'rueckfrage' | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [erledigt, setErledigt] = useState<'freigegeben' | 'rueckfrage' | null>(schonFrei ? 'freigegeben' : null)

  async function senden(aktion: 'freigeben' | 'rueckfrage') {
    setFehler(null); setLaedt(aktion)
    try {
      const res = await fetch(`/api/freigabe/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion, name, nachricht }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Das hat leider nicht geklappt. Bitte rufen Sie uns kurz an.')
      setErledigt(aktion === 'freigeben' ? 'freigegeben' : 'rueckfrage')
    } catch (e: any) {
      setFehler(e?.message ?? 'Das hat leider nicht geklappt.')
    } finally {
      setLaedt(null)
    }
  }

  if (erledigt === 'freigegeben') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-900">
        <p className="flex items-center gap-2 font-semibold"><Check className="w-5 h-5" /> Vielen Dank — Ihre Freigabe ist bei uns eingegangen.</p>
        {(freigegebenAm || freigegebenName) && schonFrei && (
          <p className="text-sm mt-1">Freigegeben{freigegebenName ? ` von ${freigegebenName}` : ''}{freigegebenAm ? ` am ${new Date(freigegebenAm).toLocaleDateString('de-DE')}` : ''}.</p>
        )}
        <p className="text-sm mt-1">Wir legen jetzt los und melden uns, sobald Ihr Fahrzeug fertig ist.</p>
      </div>
    )
  }
  if (erledigt === 'rueckfrage') {
    return (
      <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5 text-sky-900">
        <p className="flex items-center gap-2 font-semibold"><MessageCircle className="w-5 h-5" /> Ihre Nachricht wurde an die Werkstatt gesendet.</p>
        <p className="text-sm mt-1">Wir melden uns bei Ihnen. Sie können diesen Link danach wieder öffnen, um freizugeben.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      {rueckfrageGesendet && <p className="text-sm text-sky-800 bg-sky-50 border border-sky-100 rounded-lg p-3">Ihre letzte Rückfrage haben wir erhalten. Sie können hier trotzdem jederzeit freigeben.</p>}
      <div>
        <label htmlFor="freigabe-name" className="block text-sm font-medium text-slate-700 mb-1">Ihr Name</label>
        <input id="freigabe-name" value={name} onChange={e => setName(e.target.value)} maxLength={120} autoComplete="name" placeholder="Vor- und Nachname"
          className="w-full px-3 py-3 border border-slate-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-400" />
      </div>
      <button onClick={() => senden('freigeben')} disabled={laedt !== null || name.trim().length < 2}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3.5 text-base transition-colors">
        {laedt === 'freigeben' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Kostenvoranschlag freigeben
      </button>
      <p className="text-xs text-slate-400 text-center">Mit der Freigabe bestätigen Sie den oben genannten Kostenvoranschlag.</p>

      {!rueckfrageOffen ? (
        <button onClick={() => setRueckfrageOffen(true)} className="w-full text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2">Nicht einverstanden oder eine Frage?</button>
      ) : (
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <label htmlFor="freigabe-frage" className="block text-sm font-medium text-slate-700">Ihre Nachricht an die Werkstatt</label>
          <textarea id="freigabe-frage" value={nachricht} onChange={e => setNachricht(e.target.value)} maxLength={1000} rows={3} placeholder="Was ist unklar oder soll geändert werden?"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <button onClick={() => senden('rueckfrage')} disabled={laedt !== null || nachricht.trim().length < 3}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-medium py-3 transition-colors">
            {laedt === 'rueckfrage' ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />} Nachricht senden
          </button>
        </div>
      )}
      {fehler && <p className="text-sm text-red-600" role="alert">{fehler}</p>}
    </div>
  )
}
