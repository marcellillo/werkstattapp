import { notFound } from 'next/navigation'
import type { Metadata, Viewport } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveFirmaSettings } from '@/lib/firma-settings'
import { ladeKvaSummen } from '@/lib/kva-summen'
import { sichereBildQuelle } from '@/lib/html-escape'
import { FreigabeFormular } from './freigabe-formular'

// Öffentliche Seite (ohne Anmeldung): der Kunde sieht seinen Kostenvoranschlag und gibt ihn frei.
// Zugriff nur mit dem geheimen Token aus dem Link; nie indexieren, nie zwischenspeichern.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kostenvoranschlag', robots: { index: false, follow: false } }
// Kundenseite: Zoomen muss möglich sein (der Standard der App sperrt es)
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

const euro = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const menge = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 })
const datum = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

export default async function FreigabePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f]{64}$/.test(token)) notFound()

  const admin = createAdminClient()
  const { data: t } = await admin.from('kva_freigabe_tokens').select('kva_id').eq('token', token).maybeSingle()
  if (!t) notFound()
  const { data: kva } = await admin.from('kostenvoranschlaege')
    .select('id, betrieb_id, auftrag_id, fahrzeug_id, nummer, status, created_at, rechnung_id, ersatzteile_modus, ersatzteile_festpreis, freigegeben_am, freigegeben_name, freigabe_hinweis')
    .eq('id', t.kva_id).maybeSingle()
  if (!kva) notFound()

  const [firma, summen, fz] = await Promise.all([
    resolveFirmaSettings(admin, kva.betrieb_id),
    ladeKvaSummen(admin, kva as any),
    kva.fahrzeug_id ? admin.from('fahrzeuge').select('marke, modell, kennzeichen').eq('id', kva.fahrzeug_id).maybeSingle() : Promise.resolve({ data: null as any }),
  ])
  const fahrzeug = fz.data
  const logo = sichereBildQuelle(firma.firma_logo)
  const abgerechnet = !!kva.rechnung_id
  const freigegeben = kva.status === 'akzeptiert'

  return (
    <main className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        <header className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
          {logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logo} alt={firma.firma_name || 'Werkstatt'} className="h-12 w-auto max-w-[140px] object-contain" />
            : <div className="h-12 w-12 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-lg">{(firma.firma_name || 'W').slice(0, 1)}</div>}
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{firma.firma_name || 'Ihre Werkstatt'}</p>
            <p className="text-xs text-slate-500 truncate">{[firma.firma_strasse, [firma.firma_plz, firma.firma_ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
          </div>
        </header>

        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Kostenvoranschlag</p>
          <h1 className="text-xl font-bold text-slate-900 mt-1">{[fahrzeug?.marke, fahrzeug?.modell].filter(Boolean).join(' ') || 'Ihr Fahrzeug'}</h1>
          <p className="text-sm text-slate-500">
            {fahrzeug?.kennzeichen ? <span className="font-mono">{fahrzeug.kennzeichen}</span> : null}
            {fahrzeug?.kennzeichen ? ' · ' : ''}Nr. {kva.nummer || kva.id.slice(0, 8)} · {datum(kva.created_at)}
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          {(summen.teile.length > 0 || summen.teilePauschal != null) && (
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Ersatzteile & Material</h2>
              {summen.teilePauschal != null ? (
                <div className="flex justify-between text-sm py-1.5"><span className="text-slate-700">Ersatzteile (pauschal)</span><span className="font-medium">{euro(summen.teilePauschal)}</span></div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {summen.teile.map((p, i) => (
                    <li key={i} className="flex justify-between gap-3 py-1.5 text-sm">
                      <span className="text-slate-700 min-w-0">{p.beschreibung}<span className="text-slate-400"> · {menge(p.menge)} × {euro(p.einzelpreis)}</span></span>
                      <span className="font-medium whitespace-nowrap">{euro(p.gesamtpreis)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {summen.arbeit.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Arbeitszeit</h2>
              <ul className="divide-y divide-slate-100">
                {summen.arbeit.map((p, i) => (
                  <li key={i} className="flex justify-between gap-3 py-1.5 text-sm">
                    <span className="text-slate-700 min-w-0">{p.beschreibung}<span className="text-slate-400"> · {menge(p.menge)} Std. × {euro(p.einzelpreis)}</span></span>
                    <span className="font-medium whitespace-nowrap">{euro(p.gesamtpreis)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summen.teile.length === 0 && summen.teilePauschal == null && summen.arbeit.length === 0 && (
            <p className="text-sm text-slate-500">Zu diesem Kostenvoranschlag sind noch keine Positionen erfasst. Bitte rufen Sie uns kurz an.</p>
          )}

          <div className="border-t border-slate-200 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-600"><span>Zwischensumme netto</span><span>{euro(summen.netto)}</span></div>
            {!summen.kleinunternehmer && <div className="flex justify-between text-slate-600"><span>zzgl. 19 % MwSt.</span><span>{euro(summen.mwst)}</span></div>}
            <div className="flex justify-between text-base font-bold text-slate-900 pt-1"><span>Gesamt{summen.kleinunternehmer ? '' : ' (brutto)'}</span><span>{euro(summen.brutto)}</span></div>
            {summen.kleinunternehmer && <p className="text-xs text-slate-400 italic">Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</p>}
          </div>
          <p className="text-xs text-slate-400">Der endgültige Rechnungsbetrag richtet sich nach dem tatsächlichen Aufwand; bei wesentlichen Abweichungen melden wir uns vorher bei Ihnen.</p>
        </section>

        {abgerechnet ? (
          <p className="bg-slate-100 rounded-2xl p-5 text-sm text-slate-600">Dieser Kostenvoranschlag wurde bereits abgerechnet. Vielen Dank!</p>
        ) : (
          <FreigabeFormular
            token={token}
            freigegeben={freigegeben}
            freigegebenAm={kva.freigegeben_am}
            freigegebenName={kva.freigegeben_name}
            rueckfrageGesendet={kva.status === 'abgelehnt' && !!kva.freigabe_hinweis}
          />
        )}

        {(firma.firma_telefon || firma.firma_email) && (
          <p className="text-center text-sm text-slate-500">
            Fragen? {firma.firma_telefon && <a className="text-orange-600 font-medium" href={`tel:${firma.firma_telefon.replace(/[^+\d]/g, '')}`}>{firma.firma_telefon}</a>}
            {firma.firma_telefon && firma.firma_email ? ' · ' : ''}
            {firma.firma_email && <a className="text-orange-600 font-medium" href={`mailto:${firma.firma_email}`}>{firma.firma_email}</a>}
          </p>
        )}
      </div>
    </main>
  )
}
