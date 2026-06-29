'use client'
import { useState } from 'react'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const STERNE_LABEL = ['', 'Nicht zufrieden', 'Wenig zufrieden', 'Zufrieden', 'Sehr zufrieden', 'Begeistert!']
const STERNE_EMOJI = ['', '😞', '😕', '🙂', '😊', '🤩']

interface Props {
  auftrag: any
  firma: Record<string, string>
}

export function BewertungForm({ auftrag, firma }: Props) {
  const bereitsBewertet = !!auftrag.bewertung_sterne
  const [sterne, setSterne] = useState(auftrag.bewertung_sterne ?? 0)
  const [hover, setHover] = useState(0)
  const [kommentar, setKommentar] = useState('')
  const [status, setStatus] = useState<'idle' | 'senden' | 'ok' | 'fehler'>(bereitsBewertet ? 'ok' : 'idle')

  const fz = auftrag.fahrzeug as any
  const kunde = auftrag.kunde as any
  const aktivStern = hover || sterne

  async function absenden() {
    if (sterne === 0) return
    setStatus('senden')
    const sb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error } = await sb.from('auftraege').update({
      bewertung_sterne: sterne,
      bewertung_kommentar: kommentar || null,
      bewertung_datum: new Date().toISOString(),
    }).eq('id', auftrag.id)
    setStatus(error ? 'fehler' : 'ok')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div className="max-w-md mx-auto">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">{firma.firma_name || 'Ihre Werkstatt'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {fz ? `${fz.marke} ${fz.modell} · ${fz.kennzeichen}` : `Auftrag ${auftrag.auftrag_nr}`}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">

          {status === 'ok' ? (
            /* Dankeschön */
            <div className="text-center space-y-5">
              <div className="text-6xl">{STERNE_EMOJI[auftrag.bewertung_sterne ?? sterne]}</div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Vielen Dank!</h1>
                <p className="text-gray-500 mt-2 text-sm">
                  {kunde ? `${kunde.vorname}, Ihr` : 'Ihr'} Feedback hilft uns, unseren Service stetig zu verbessern.
                </p>
              </div>
              <div className="flex justify-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <span key={s} className="text-3xl">
                    {s <= (auftrag.bewertung_sterne ?? sterne) ? '★' : '☆'}
                  </span>
                ))}
              </div>
              {firma.firma_telefon && (
                <p className="text-xs text-gray-400 mt-4">
                  Fragen? Erreichbar unter{' '}
                  <a href={`tel:${firma.firma_telefon}`} className="text-orange-600 font-medium">{firma.firma_telefon}</a>
                </p>
              )}
            </div>
          ) : (
            /* Bewertungsformular */
            <div className="space-y-7">
              <div className="text-center">
                <div className="text-4xl mb-4">{aktivStern > 0 ? STERNE_EMOJI[aktivStern] : '🔧'}</div>
                <h1 className="text-2xl font-bold text-gray-900">Wie war Ihr Besuch?</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {kunde ? `${kunde.vorname}, wir` : 'Wir'} freuen uns über Ihr ehrliches Feedback.
                </p>
              </div>

              {/* Sterne */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center mb-4">Zufriedenheit</p>
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      type="button"
                      onMouseEnter={() => setHover(s)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setSterne(s)}
                      className="text-4xl transition-transform active:scale-95 select-none"
                      style={{ filter: s <= aktivStern ? 'none' : 'grayscale(1) opacity(0.35)' }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {aktivStern > 0 && (
                  <p className="text-center text-sm font-semibold text-orange-600 mt-3">{STERNE_LABEL[aktivStern]}</p>
                )}
              </div>

              {/* Kommentar */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-3">
                  Kommentar <span className="text-gray-300 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={kommentar}
                  onChange={e => setKommentar(e.target.value)}
                  placeholder="Was hat Ihnen besonders gefallen? Was können wir verbessern?"
                  rows={4}
                  className="w-full text-sm text-gray-700 resize-none focus:outline-none placeholder-gray-300"
                />
              </div>

              {/* Absenden */}
              <button
                onClick={absenden}
                disabled={sterne === 0 || status === 'senden'}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-40"
                style={{ background: sterne > 0 ? '#ea580c' : '#e5e7eb', color: sterne > 0 ? 'white' : '#9ca3af' }}
              >
                {status === 'senden' ? 'Wird gesendet…' : 'Bewertung abschicken'}
              </button>

              {status === 'fehler' && (
                <p className="text-center text-xs text-red-500">Fehler beim Senden — bitte versuchen Sie es erneut.</p>
              )}

              <p className="text-center text-xs text-gray-300">
                Ihre Bewertung wird nur intern verwendet und nicht öffentlich angezeigt.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
