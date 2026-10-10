// "Zu erledigen" auf der Startseite: offene Kundenrechnungen und Datenlücken, die später Arbeit machen
// (Kunde ohne Kontakt = nicht erreichbar, Fahrzeug ohne HU-Datum = kein TÜV-Wecker).
import Link from 'next/link'
import { AlertTriangle, ChevronRight, Database, Euro, PhoneOff, ShieldQuestion } from 'lucide-react'

export type Forderungen = { anzahl: number; summe: number; ueberfaellig: number; ueberfaelligSumme: number }
/** sicherungTage: nur für Administratoren gesetzt, wenn die Datensicherung fällig ist (null = noch nie heruntergeladen) */
export type Luecken = { kundenOhneKontakt: number; fahrzeugeOhneHu: number; sicherungTage?: number | null }

const euro = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export function ZuTunKarte({ forderungen, luecken }: { forderungen: Forderungen; luecken: Luecken }) {
  const zeilen: { key: string; href: string; icon: any; farbe: string; titel: string; text: string }[] = []

  if (forderungen.ueberfaellig > 0) {
    zeilen.push({
      key: 'ueberfaellig', href: '/buchhaltung?tab=rechnungen&filter=ueberfaellig', icon: AlertTriangle, farbe: 'bg-red-50 text-red-600',
      titel: `${forderungen.ueberfaellig} ${forderungen.ueberfaellig === 1 ? 'Rechnung' : 'Rechnungen'} überfällig · ${euro(forderungen.ueberfaelligSumme)}`,
      text: 'Zahlungserinnerung per WhatsApp senden',
    })
  }
  const nochNichtFaellig = forderungen.anzahl - forderungen.ueberfaellig
  if (nochNichtFaellig > 0) {
    zeilen.push({
      key: 'offen', href: '/buchhaltung?tab=rechnungen&filter=offen', icon: Euro, farbe: 'bg-amber-50 text-amber-600',
      titel: `${nochNichtFaellig} ${nochNichtFaellig === 1 ? 'Rechnung' : 'Rechnungen'} offen · ${euro(forderungen.summe - forderungen.ueberfaelligSumme)}`,
      text: 'Zahlungsziel noch nicht erreicht',
    })
  }
  if (luecken.kundenOhneKontakt > 0) {
    zeilen.push({
      key: 'kontakt', href: '/kunden?ohne=kontakt', icon: PhoneOff, farbe: 'bg-slate-100 text-slate-600',
      titel: `${luecken.kundenOhneKontakt} ${luecken.kundenOhneKontakt === 1 ? 'Kunde' : 'Kunden'} ohne Kontakt`,
      text: 'Ohne Handynummer oder E-Mail klappen Fertig-Meldung, Freigabe und Erinnerungen nicht',
    })
  }
  if (luecken.fahrzeugeOhneHu > 0) {
    zeilen.push({
      key: 'hu', href: '/tuev-wecker#ohne-hu', icon: ShieldQuestion, farbe: 'bg-slate-100 text-slate-600',
      titel: `${luecken.fahrzeugeOhneHu} ${luecken.fahrzeugeOhneHu === 1 ? 'Fahrzeug' : 'Fahrzeuge'} ohne HU-Datum`,
      text: 'Datum von der Plakette eintragen, dann erinnert der TÜV-Wecker rechtzeitig',
    })
  }
  if (luecken.sicherungTage !== undefined) {
    zeilen.push({
      key: 'sicherung', href: '/einstellungen#sicherung', icon: Database, farbe: 'bg-slate-100 text-slate-600',
      titel: luecken.sicherungTage === null ? 'Datensicherung: noch nie heruntergeladen' : `Datensicherung: zuletzt vor ${luecken.sicherungTage} Tagen`,
      text: 'Ein Klick sichert alle Kunden-, Auftrags- und Rechnungsdaten auf Ihren Rechner',
    })
  }
  if (zeilen.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-800">Zu erledigen</div>
      <div className="divide-y divide-gray-50">
        {zeilen.map(z => (
          <Link key={z.key} href={z.href} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${z.farbe}`}><z.icon className="w-5 h-5" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-900">{z.titel}</span>
              <span className="block text-xs text-gray-500">{z.text}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
