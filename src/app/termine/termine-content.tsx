'use client'
import { useState } from 'react'
import { Calendar, Plus, ShieldCheck, Globe, Phone, Clock, Car, User, Trash2, CheckCircle, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { TerminTyp, TerminStatus } from '@/types/database'

const TYP_CONFIG: Record<TerminTyp, { label: string; icon: typeof Calendar; color: string; bg: string }> = {
  werkstatt: { label: 'Werkstatt', icon: Car, color: 'text-orange-600', bg: 'bg-orange-100' },
  tuev: { label: 'TÜV', icon: ShieldCheck, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  online: { label: 'Online-Buchung', icon: Globe, color: 'text-blue-600', bg: 'bg-blue-100' },
}

const STATUS_CONFIG: Record<TerminStatus, { label: string; color: string }> = {
  offen: { label: 'Offen', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  bestaetigt: { label: 'Bestätigt', color: 'bg-green-100 text-green-700 border-green-200' },
  erledigt: { label: 'Erledigt', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  abgesagt: { label: 'Abgesagt', color: 'bg-red-100 text-red-600 border-red-200' },
}

const today = new Date().toISOString().split('T')[0]

export function TermineContent({ termine: initialTermine, kunden, fahrzeuge, hebebuehnen }: {
  termine: any[]; kunden: any[]; fahrzeuge: any[]; hebebuehnen: any[]
}) {
  const [termine, setTermine] = useState(initialTermine)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'alle' | TerminTyp>('alle')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const [form, setForm] = useState({
    titel: '', beschreibung: '', datum: today, uhrzeit: '09:00',
    dauer_minuten: 60, typ: 'werkstatt' as TerminTyp,
    kunden_id: '', fahrzeug_id: '', hebebuehne_id: '', notizen: '', quelle: 'manuell'
  })

  const filtered = termine.filter(t => filter === 'alle' || t.typ === filter)
  const upcoming = filtered.filter(t => t.datum >= today && t.status !== 'abgesagt')
  const past = filtered.filter(t => t.datum < today || t.status === 'erledigt' || t.status === 'abgesagt')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titel || !form.datum) return
    setSaving(true)
    const { data } = await supabase.from('termine').insert({
      titel: form.titel, beschreibung: form.beschreibung || null, datum: form.datum,
      uhrzeit: form.uhrzeit || null, dauer_minuten: form.dauer_minuten, typ: form.typ,
      kunden_id: form.kunden_id || null, fahrzeug_id: form.fahrzeug_id || null,
      hebebuehne_id: form.hebebuehne_id || null,
      notizen: form.notizen || null, quelle: form.quelle, status: 'offen',
    }).select('*, kunde:kunden(*), fahrzeug:fahrzeuge(*), hebebuehne:hebebuehnen(id,bezeichnung,nummer)').single()
    if (data) { setTermine(p => [...p, data].sort((a, b) => a.datum.localeCompare(b.datum))); setShowForm(false) }
    setSaving(false)
  }

  async function handleStatus(id: string, status: TerminStatus) {
    const termin = termine.find(t => t.id === id)
    const freigeben = status === 'erledigt' && termin?.hebebuehne_id
    setTermine(p => p.map(t => t.id === id
      ? { ...t, status, hebebuehne_id: freigeben ? null : t.hebebuehne_id, hebebuehne: freigeben ? null : t.hebebuehne }
      : t
    ))
    const update: any = { status }
    if (freigeben) update.hebebuehne_id = null
    await supabase.from('termine').update(update).eq('id', id)
  }

  async function handleDelete(id: string) {
    setTermine(p => p.filter(t => t.id !== id))
    await supabase.from('termine').delete().eq('id', id)
  }

  const counts = { alle: termine.length, werkstatt: 0, tuev: 0, online: 0 }
  for (const t of termine) { if (counts[t.typ as TerminTyp] !== undefined) counts[t.typ as TerminTyp]++ }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Termine</h1>
          <p className="text-sm text-gray-800 mt-0.5">{upcoming.length} anstehend · {termine.length} gesamt</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" />Neuer Termin
        </Button>
      </div>

      {/* Website integration hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Globe className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-blue-800 text-sm">Online-Terminbuchung verbinden</p>
          <p className="text-sm text-blue-600 mt-0.5">
            Sobald Sie den Admin-Zugang Ihrer Website mitteilen, können Online-Buchungen automatisch hier erscheinen.
            Bis dahin können Sie Termine manuell anlegen.
          </p>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" />Neuer Termin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-800 mb-1 block">Titel *</label>
                  <input value={form.titel} onChange={e => setForm(p => ({ ...p, titel: e.target.value }))}
                    placeholder="z.B. TÜV-Prüfer Besuch, Kundenfahrzeug Abholung..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-800 mb-1 block">Typ</label>
                  <div className="flex gap-2">
                    {(Object.keys(TYP_CONFIG) as TerminTyp[]).map(t => (
                      <button key={t} type="button" onClick={() => setForm(p => ({ ...p, typ: t }))}
                        className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                          form.typ === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
                        {TYP_CONFIG[t].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-800 mb-1 block">Datum *</label>
                  <input type="date" value={form.datum} onChange={e => setForm(p => ({ ...p, datum: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-800 mb-1 block">Uhrzeit</label>
                  <input type="time" value={form.uhrzeit} onChange={e => setForm(p => ({ ...p, uhrzeit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-800 mb-1 block">Dauer (Min.)</label>
                  <input type="number" value={form.dauer_minuten} min={15} step={15} onChange={e => setForm(p => ({ ...p, dauer_minuten: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-800 mb-1 block">Kunde</label>
                  <select value={form.kunden_id} onChange={e => setForm(p => ({ ...p, kunden_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="">— Kein Kunde —</option>
                    {kunden.map(k => <option key={k.id} value={k.id}>{k.vorname} {k.nachname}{k.firma ? ` (${k.firma})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-800 mb-1 block">Fahrzeug</label>
                  <select value={form.fahrzeug_id} onChange={e => setForm(p => ({ ...p, fahrzeug_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="">— Kein Fahrzeug —</option>
                    {fahrzeuge.map(f => <option key={f.id} value={f.id}>{f.marke} {f.modell} · {f.kennzeichen}</option>)}
                  </select>
                </div>
                {form.typ === 'tuev' && (
                  <div className="col-span-2">
                    <label className="text-xs text-gray-800 mb-1 block flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-yellow-600" />
                      Bühne reservieren (TÜV)
                    </label>
                    <select value={form.hebebuehne_id} onChange={e => setForm(p => ({ ...p, hebebuehne_id: e.target.value }))}
                      className="w-full px-3 py-2 border-2 border-yellow-300 bg-yellow-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                      <option value="">— Keine Bühne reservieren —</option>
                      {hebebuehnen.map(h => <option key={h.id} value={h.id}>Bühne {h.nummer} · {h.bezeichnung}</option>)}
                    </select>
                    <p className="text-xs text-yellow-700 mt-1">Die Bühne wird im Dashboard als TÜV-reserviert angezeigt.</p>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-xs text-gray-800 mb-1 block">Notizen</label>
                  <textarea value={form.notizen} onChange={e => setForm(p => ({ ...p, notizen: e.target.value }))} rows={2}
                    placeholder="Zusätzliche Informationen..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
                  {saving ? 'Speichern...' : 'Termin anlegen'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Abbrechen</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['alle', 'werkstatt', 'tuev', 'online'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
            {f === 'alle' ? `Alle (${counts.alle})` : `${TYP_CONFIG[f as TerminTyp].label} (${counts[f as TerminTyp]})`}
          </button>
        ))}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Anstehend</h2>
          <div className="space-y-2">
            {upcoming.map(t => <TerminCard key={t.id} termin={t} onStatus={handleStatus} onDelete={handleDelete} />)}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Vergangen</h2>
          <div className="space-y-2 opacity-70">
            {past.slice(0, 10).map(t => <TerminCard key={t.id} termin={t} onStatus={handleStatus} onDelete={handleDelete} />)}
          </div>
        </div>
      )}

      {termine.length === 0 && (
        <Card><CardContent className="py-16 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-800">Keine Termine vorhanden</p>
        </CardContent></Card>
      )}
    </div>
  )
}

function TerminCard({ termin, onStatus, onDelete }: {
  termin: any; onStatus: (id: string, s: TerminStatus) => void; onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const cfg = TYP_CONFIG[termin.typ as TerminTyp] ?? TYP_CONFIG.werkstatt
  const statusCfg = STATUS_CONFIG[termin.status as TerminStatus] ?? STATUS_CONFIG.offen
  const isPast = termin.datum < today

  return (
    <div className={cn('bg-white border rounded-xl overflow-hidden transition-shadow hover:shadow-sm', isPast ? 'border-gray-100' : 'border-gray-200')}>
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className={cn('w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0', cfg.bg)}>
          <span className={cn('text-sm font-bold', cfg.color)}>
            {new Date(termin.datum + 'T00:00:00').getDate()}
          </span>
          <span className={cn('text-xs', cfg.color)}>
            {new Date(termin.datum + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' })}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">{termin.titel}</p>
            <cfg.icon className={cn('w-3.5 h-3.5 flex-shrink-0', cfg.color)} />
          </div>
          <p className="text-xs text-gray-600">
            {formatDate(termin.datum)}
            {termin.uhrzeit && ` · ${termin.uhrzeit.slice(0, 5)} Uhr`}
            {termin.dauer_minuten && ` · ${termin.dauer_minuten} Min.`}
          </p>
          {(termin.kunde || termin.fahrzeug || termin.hebebuehne) && (
            <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-2 flex-wrap">
              {termin.kunde && <span><User className="w-3 h-3 inline mr-0.5" />{termin.kunde.vorname} {termin.kunde.nachname}</span>}
              {termin.fahrzeug && <span><Car className="w-3 h-3 inline mr-0.5" />{termin.fahrzeug.kennzeichen}</span>}
              {termin.hebebuehne && (
                <span className="flex items-center gap-0.5 bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                  <ShieldCheck className="w-3 h-3" />Bühne {termin.hebebuehne.nummer} reserviert
                </span>
              )}
            </p>
          )}
        </div>
        <span className={cn('text-xs px-2 py-1 rounded-full border font-medium flex-shrink-0', statusCfg.color)}>
          {statusCfg.label}
        </span>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-3 bg-gray-50/50 space-y-3">
          {termin.notizen && <p className="text-sm text-gray-600">{termin.notizen}</p>}
          <div className="flex flex-wrap gap-2">
            {(['offen', 'bestaetigt', 'erledigt', 'abgesagt'] as TerminStatus[]).map(s => (
              <button key={s} onClick={() => onStatus(termin.id, s)}
                className={cn('text-xs px-2.5 py-1 rounded-full border font-medium transition-all',
                  termin.status === s ? cn(STATUS_CONFIG[s].color, 'ring-2 ring-offset-1 ring-gray-400') : STATUS_CONFIG[s].color)}>
                {STATUS_CONFIG[s].label}
              </button>
            ))}
            <button onClick={() => onDelete(termin.id)} className="text-xs px-2.5 py-1 rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors ml-auto">
              <Trash2 className="w-3.5 h-3.5 inline mr-0.5" />Löschen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

