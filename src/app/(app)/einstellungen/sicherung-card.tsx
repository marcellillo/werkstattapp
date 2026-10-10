'use client'
// Datensicherung: alle Betriebsdaten als ZIP (JSON je Tabelle) auf den eigenen Rechner laden
import { useState } from 'react'
import { Database, Download, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { vorTagen } from '@/lib/zahlung'

export function SicherungCard({ letzteSicherung }: { letzteSicherung: string | null }) {
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<{ downloadUrl: string; dateiname: string; groesse: number; tabellen: { name: string; anzahl: number }[]; hinweise: string[] } | null>(null)
  const [stand, setStand] = useState(letzteSicherung)

  async function erstellen() {
    setLaeuft(true); setFehler(null); setErgebnis(null)
    try {
      const res = await fetch('/api/backup/export', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Die Sicherung konnte nicht erstellt werden.')
      setErgebnis(d)
      setStand(new Date().toISOString())
    } catch (e: any) {
      setFehler(e?.message ?? 'Die Sicherung konnte nicht erstellt werden.')
    } finally {
      setLaeuft(false)
    }
  }

  const datensaetze = ergebnis?.tabellen.reduce((s, t) => s + t.anzahl, 0) ?? 0
  return (
    <Card id="sicherung" className="scroll-mt-20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5 text-orange-500" /> Datensicherung</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600">
          Lädt alle Daten Ihres Betriebs (Kunden, Fahrzeuge, Aufträge, Termine, Rechnungen …) als ZIP auf Ihren Rechner. Fotos und PDFs sind darin nicht enthalten,
          Zugangsdaten ebenfalls nicht. Bewahren Sie die Datei sicher auf — sie enthält Kundendaten.
        </p>
        <p className="text-sm text-slate-500">
          Letzte Sicherung: <strong className="text-slate-700">{stand ? `${new Date(stand).toLocaleDateString('de-DE')} (${vorTagen(stand)})` : 'noch nie heruntergeladen'}</strong>
        </p>
        {fehler && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fehler}</p>}
        {ergebnis && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 space-y-1">
            <p>{datensaetze.toLocaleString('de-DE')} Datensätze aus {ergebnis.tabellen.length} Tabellen gesichert.</p>
            {ergebnis.hinweise.map((h, i) => <p key={i} className="text-amber-800">⚠ {h}</p>)}
            <a href={ergebnis.downloadUrl} className="mt-1 inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2">
              <Download className="w-4 h-4" /> {ergebnis.dateiname} ({(ergebnis.groesse / 1024).toLocaleString('de-DE', { maximumFractionDigits: 0 })} KB)
            </a>
            <p className="text-xs text-emerald-800">Der Link gilt 10 Minuten.</p>
          </div>
        )}
        <button onClick={erstellen} disabled={laeuft}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium disabled:opacity-60">
          {laeuft ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird erstellt …</> : <><Database className="w-4 h-4" /> Sicherung erstellen</>}
        </button>
      </CardContent>
    </Card>
  )
}
