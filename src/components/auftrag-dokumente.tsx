'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Upload, Trash2, Download, Loader2, Pencil, Check, X, FolderOpen, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DOKUMENT_BUCKET, DOKUMENT_KATEGORIEN, DOKUMENT_MAX_BYTES, erlaubterTyp, formatGroesse, rateKategorie,
  type AuftragDokument, type DokumentKategorie,
} from '@/lib/auftrag-dokumente'

type Auswahl = 'auto' | DokumentKategorie

function fmtDatum(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Dokumente & Dateien (PDF/Bild) zu einem Auftrag/Fahrzeug: CarVertical, Gutachten, Fahrzeugbrief ...
// Alles hier Gespeicherte erscheint in der Auftragsmappe.
export function AuftragDokumente({ auftragId }: { auftragId: string }) {
  const supabase = createClient()
  const [dokumente, setDokumente] = useState<AuftragDokument[]>([])
  const [laden, setLaden] = useState(true)
  const [uploadInfo, setUploadInfo] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [auswahl, setAuswahl] = useState<Auswahl>('auto')
  const [dragOver, setDragOver] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTitel, setEditTitel] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function ladeDokumente() {
    const { data, error } = await supabase
      .from('auftrag_dokumente')
      .select('id, auftrag_id, kategorie, titel, datei_name, datei_typ, groesse, erstellt_am')
      .eq('auftrag_id', auftragId)
      .order('erstellt_am', { ascending: false })
    if (error) { console.error('[Dokumente] Laden fehlgeschlagen:', error); setFehler('Die Dokumente konnten nicht geladen werden.') }
    else setDokumente((data ?? []) as AuftragDokument[])
    setLaden(false)
  }

  useEffect(() => { ladeDokumente() }, [auftragId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function hochladen(dateien: File[]) {
    if (!dateien.length) return
    setFehler(null)
    const probleme: string[] = []

    for (let i = 0; i < dateien.length; i++) {
      const datei = dateien[i]
      setUploadInfo(dateien.length > 1 ? `${i + 1} von ${dateien.length}: ${datei.name}` : datei.name)
      const mime = erlaubterTyp(datei.name, datei.type)
      if (!mime) { probleme.push(`${datei.name}: nur PDF oder Bilder (JPG, PNG, WebP) möglich`); continue }
      if (datei.size > DOKUMENT_MAX_BYTES) { probleme.push(`${datei.name}: zu groß (maximal 25 MB)`); continue }
      try {
        // 1) Upload-Berechtigung  2) Datei direkt in den privaten Speicher  3) Dokument eintragen
        const r1 = await fetch('/api/auftrag-dokument/upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auftragId, dateiname: datei.name, typ: mime, groesse: datei.size }),
        })
        const d1 = await r1.json().catch(() => ({}))
        if (!r1.ok) throw new Error(d1.error ?? `Fehler ${r1.status}`)

        const { error: upErr } = await supabase.storage.from(DOKUMENT_BUCKET).uploadToSignedUrl(d1.pfad, d1.token, datei, { contentType: mime })
        if (upErr) throw new Error(upErr.message)

        const r2 = await fetch('/api/auftrag-dokument', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auftragId, pfad: d1.pfad, dateiname: datei.name,
            kategorie: auswahl === 'auto' ? rateKategorie(datei.name) : auswahl,
          }),
        })
        const d2 = await r2.json().catch(() => ({}))
        if (!r2.ok) throw new Error(d2.error ?? `Fehler ${r2.status}`)
        setDokumente(prev => [d2.dokument as AuftragDokument, ...prev])
      } catch (e: any) {
        probleme.push(`${datei.name}: ${e.message}`)
      }
    }
    setUploadInfo(null)
    if (probleme.length) setFehler(probleme.join('\n'))
  }

  async function kategorieAendern(d: AuftragDokument, kategorie: DokumentKategorie) {
    const vorher = d.kategorie
    setDokumente(prev => prev.map(x => x.id === d.id ? { ...x, kategorie } : x))
    const res = await fetch('/api/auftrag-dokument', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, kategorie }),
    })
    if (!res.ok) {
      setDokumente(prev => prev.map(x => x.id === d.id ? { ...x, kategorie: vorher } : x))
      setFehler((await res.json().catch(() => ({}))).error ?? 'Kategorie konnte nicht geändert werden')
    }
  }

  async function titelSpeichern(d: AuftragDokument) {
    const titel = editTitel.trim()
    const res = await fetch('/api/auftrag-dokument', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, titel }),
    })
    if (!res.ok) { setFehler((await res.json().catch(() => ({}))).error ?? 'Titel konnte nicht gespeichert werden'); return }
    setDokumente(prev => prev.map(x => x.id === d.id ? { ...x, titel: titel || null } : x))
    setEditId(null)
  }

  async function loeschen(d: AuftragDokument) {
    if (!confirm(`„${d.titel || d.datei_name}“ wirklich löschen? Die Datei wird dauerhaft entfernt.`)) return
    const res = await fetch('/api/auftrag-dokument/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id }),
    })
    if (!res.ok) { setFehler((await res.json().catch(() => ({}))).error ?? 'Löschen fehlgeschlagen'); return }
    setDokumente(prev => prev.filter(x => x.id !== d.id))
  }

  const gruppen = DOKUMENT_KATEGORIEN
    .map(k => ({ ...k, items: dokumente.filter(d => d.kategorie === k.value) }))
    .filter(g => g.items.length > 0)
  const uploading = uploadInfo !== null

  return (
    <div id="dokumente" className="space-y-4 scroll-mt-20">
      <div className="flex items-center gap-2">
        <FolderOpen className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-gray-900">Dokumente & Dateien</h3>
        <span className="text-xs text-gray-400 ml-auto">{dokumente.length > 0 ? `${dokumente.length} gespeichert · erscheinen in der Auftragsmappe` : 'erscheinen in der Auftragsmappe'}</span>
      </div>

      {/* Kategorie + Upload */}
      <div className="space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {([{ value: 'auto', kurz: 'Automatisch' }, ...DOKUMENT_KATEGORIEN] as { value: Auswahl; kurz: string }[]).map(k => (
            <button key={k.value} onClick={() => setAuswahl(k.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                auswahl === k.value ? 'bg-orange-100 text-orange-700 border-orange-300' : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}>
              {k.kurz}
            </button>
          ))}
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); hochladen(Array.from(e.dataTransfer.files)) }}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
          } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
        >
          <input ref={inputRef} type="file" multiple accept="application/pdf,image/*" className="hidden"
            onChange={e => { hochladen(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-orange-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Wird hochgeladen… <span className="text-gray-400 truncate max-w-[200px]">{uploadInfo}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-6 h-6 text-gray-300" />
              <p className="text-sm font-medium text-gray-700">PDF oder Bild hinzufügen</p>
              <p className="text-xs text-gray-400">z. B. CarVertical-Bericht, Gutachten, Fahrzeugbrief · mehrere Dateien möglich · bis 25 MB</p>
            </div>
          )}
        </div>
      </div>

      {fehler && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="whitespace-pre-wrap flex-1">{fehler}</span>
          <button onClick={() => setFehler(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {laden ? (
        <p className="text-sm text-gray-400 text-center py-2"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Lade…</p>
      ) : gruppen.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-2">Noch keine Dokumente gespeichert</p>
      ) : (
        <div className="space-y-4">
          {gruppen.map(g => (
            <div key={g.value}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{g.label}</p>
              <div className="space-y-1.5">
                {g.items.map(d => {
                  const istBild = d.datei_typ.startsWith('image/')
                  const url = `/api/auftrag-dokument/datei?id=${d.id}`
                  return (
                    <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 bg-white">
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {istBild
                          ? <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                          : <FileText className="w-6 h-6 text-red-500" />}
                      </a>
                      <div className="flex-1 min-w-0">
                        {editId === d.id ? (
                          <div className="flex items-center gap-1">
                            <input autoFocus value={editTitel} onChange={e => setEditTitel(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') titelSpeichern(d); if (e.key === 'Escape') setEditId(null) }}
                              placeholder={d.datei_name} className="flex-1 min-w-0 px-2 py-1 border border-gray-200 rounded text-sm" />
                            <button onClick={() => titelSpeichern(d)} className="p-1 text-green-600" title="Speichern"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditId(null)} className="p-1 text-gray-400" title="Abbrechen"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium text-gray-800 hover:text-orange-600 break-words sm:truncate">
                            {d.titel || d.datei_name}
                          </a>
                        )}
                        <p className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                          <span>{fmtDatum(d.erstellt_am)}{d.groesse ? ` · ${formatGroesse(d.groesse)}` : ''}</span>
                          <select value={d.kategorie} onChange={e => kategorieAendern(d, e.target.value as DokumentKategorie)}
                            className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600" title="Kategorie ändern">
                            {DOKUMENT_KATEGORIEN.map(k => <option key={k.value} value={k.value}>{k.kurz}</option>)}
                          </select>
                        </p>
                      </div>
                      <div className="flex items-center flex-shrink-0">
                        <button onClick={() => { setEditId(d.id); setEditTitel(d.titel ?? '') }} className="p-1.5 text-gray-400 hover:text-gray-700" title="Titel ändern"><Pencil className="w-4 h-4" /></button>
                        <a href={`${url}&download=1`} className="p-1.5 text-gray-400 hover:text-gray-700" title="Herunterladen"><Download className="w-4 h-4" /></a>
                        <button onClick={() => loeschen(d)} className="p-1.5 text-gray-400 hover:text-red-600" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
