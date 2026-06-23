'use client'
import { useState } from 'react'
import { Users, Search, Plus, Phone, MapPin, Building } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Kunde } from '@/types/database'

export function KundenContent({ kunden: initialKunden }: { kunden: Kunde[] }) {
  const [kunden, setKunden] = useState(initialKunden)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    vorname: '', nachname: '', firma: '', email: '', telefon: '', mobil: '', strasse: '', plz: '', ort: ''
  })
  const supabase = createClient()

  const filtered = kunden.filter(k => {
    const q = search.toLowerCase()
    return !q ||
      k.vorname?.toLowerCase().includes(q) ||
      k.nachname?.toLowerCase().includes(q) ||
      k.firma?.toLowerCase().includes(q) ||
      k.telefon?.includes(q) ||
      k.ort?.toLowerCase().includes(q)
  })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nachname) return
    setSaving(true)
    const { data } = await supabase.from('kunden').insert({
      vorname: form.vorname || null,
      nachname: form.nachname,
      firma: form.firma || null,
      email: form.email || null,
      telefon: form.telefon || null,
      mobil: form.mobil || null,
      strasse: form.strasse || null,
      plz: form.plz || null,
      ort: form.ort || null,
    }).select().single()
    if (data) {
      setKunden(prev => [data as Kunde, ...prev])
      setForm({ vorname: '', nachname: '', firma: '', email: '', telefon: '', mobil: '', strasse: '', plz: '', ort: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kunden</h1>
          <p className="text-sm text-gray-800 mt-0.5">{kunden.length} Kunden gesamt</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" />Neuer Kunde
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleAdd} className="space-y-3">
              <h3 className="font-semibold text-gray-800 mb-3">Neuen Kunden anlegen</h3>
              <div className="grid grid-cols-2 gap-3">
                {(['vorname', 'nachname', 'firma', 'email', 'telefon', 'mobil', 'strasse', 'plz', 'ort'] as const).map(key => (
                  <div key={key} className={['firma','email','strasse'].includes(key) ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-800 mb-1 block capitalize">{key}{key === 'nachname' ? ' *' : ''}</label>
                    <input
                      value={form[key]}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
                  {saving ? 'Speichern...' : 'Kunde anlegen'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Abbrechen</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, Firma, Ort..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-800">Keine Kunden gefunden</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(k => (
            <Card key={k.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 font-bold text-sm">
                      {(k.vorname?.charAt(0) ?? '')}{(k.nachname?.charAt(0) ?? '')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{k.vorname} {k.nachname}</p>
                    {k.firma && <p className="text-xs text-gray-800 flex items-center gap-1 mt-0.5"><Building className="w-3 h-3" />{k.firma}</p>}
                    {k.telefon && <p className="text-xs text-gray-800 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{k.telefon}</p>}
                    {k.ort && <p className="text-xs text-gray-800 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{k.ort}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

