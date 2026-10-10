import Link from 'next/link'
import { Bell, Camera, CheckCircle2, ClipboardList, Clock, FileText, MessageCircle, PackagePlus, Receipt, Send, Users } from 'lucide-react'

export const metadata = { title: 'Anleitung' }

const SCHRITTE: { icon: any; titel: string; text: string; tipp?: string }[] = [
  {
    icon: Camera, titel: '1. Auftrag anlegen und Fahrzeug annehmen',
    text: 'Auf der Startseite „Neuer Auftrag“ antippen, den Fahrzeugschein fotografieren — Fahrzeug und Kunde werden ausgefüllt, nur die Handynummer fehlt noch. Danach öffnet sich die Annahme: Kilometerstand, Tank, Vorschäden, 4 Fotos rundherum und (wenn der Kunde da ist) seine Unterschrift.',
    tipp: 'Jeder Kunde braucht Handynummer oder E-Mail — sonst klappen Fertig-Meldung, Freigabe und Erinnerungen nicht.',
  },
  {
    icon: PackagePlus, titel: '2. Kostenvoranschlag in einem Klick',
    text: 'Im Auftrag „Leistungspaket hinzufügen“ (Ölwechsel, Inspektion …): Teile, Arbeitszeit und Öl sind sofort drin. Preise und Mengen im Kostenvoranschlag bei Bedarf anpassen.',
  },
  {
    icon: Send, titel: '3. Zur Freigabe an den Kunden senden',
    text: '„Zur Freigabe an den Kunden senden“ → WhatsApp oder E-Mail. Der Kunde sieht den Kostenvoranschlag auf dem Handy und gibt ihn ohne Anmeldung frei; du bekommst eine Benachrichtigung. Fotos aus der Fotoansicht, die du für den Kunden freigibst (Auge-Symbol), erscheinen dort als „Das haben wir gefunden“.',
  },
  {
    icon: Clock, titel: '4. Arbeitszeit stempeln',
    text: 'Im Auftrag „Arbeit starten“, wenn es losgeht, „Stoppen“, wenn Schluss ist. Vergessen? „Zeit nachtragen“. Auf der Startseite siehst du unter „Läuft gerade“, wer woran arbeitet; in den Statistiken ist die Auswertung (gestempelt gegen abgerechnet).',
    tipp: 'Pro Mitarbeiter läuft nur eine Zeit. Wer an einem anderen Auftrag startet, beendet die alte automatisch.',
  },
  {
    icon: Receipt, titel: '5. Rechnung schreiben',
    text: 'Der große Knopf „Rechnung erstellen“ übernimmt Teile, Arbeit und das vorbelegte Öl aus dem Paket. Das Zahlungsziel (Standard 14 Tage) steht automatisch drauf; ab dann meldet die Startseite offene und überfällige Rechnungen.',
  },
  {
    icon: CheckCircle2, titel: '6. Fertig melden und übergeben',
    text: '„Fertig“ → der Kunde kann direkt per WhatsApp, SMS oder E-Mail benachrichtigt werden. Beim Übergeben Kilometerstand eintragen. Die Auftragsmappe (Komplett-PDF mit allen Dokumenten und Fotos) holst du über „Auftragsmappe“.',
  },
  {
    icon: MessageCircle, titel: 'Erinnern statt hinterhertelefonieren',
    text: 'TÜV-Wecker und Service-Wecker zeigen, wer bald dran ist — ein Tipp öffnet WhatsApp mit fertigem Text und merkt sich, dass erinnert wurde. Für überfällige Rechnungen gibt es dasselbe in der Buchhaltung.',
    tipp: 'Fehlt bei Fahrzeugen das HU-Datum, trägst du es im TÜV-Wecker unten direkt nach (Monat von der Plakette).',
  },
  {
    icon: FileText, titel: 'Monatsabschluss',
    text: 'Buchhaltung → „Steuerberater“: ein ZIP mit allen Rechnungslisten (Excel), auf Wunsch den Rechnungs-PDFs und allen Eingangsbelegen. Einstellungen → „Datensicherung“ sichert alle Daten auf deinen Rechner (Startseite erinnert nach 30 Tagen).',
  },
]

export default function HilfePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><ClipboardList className="w-6 h-6 text-orange-500" /> So läuft ein Auftrag</h1>
        <p className="text-sm text-slate-500 mt-1">Der Ablauf von der Annahme bis zur Rechnung — jeweils der kürzeste Weg.</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <Bell className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Einmal je Gerät: Benachrichtigungen einschalten</p>
          <p className="mt-0.5">Dann kommt jede neue Online-Buchung und jede Kundenfreigabe sofort aufs Handy. <Link href="/einstellungen" className="underline font-medium">Einstellungen → Benachrichtigungen</Link></p>
        </div>
      </div>

      <ol className="space-y-3">
        {SCHRITTE.map(s => (
          <li key={s.titel} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-900 flex items-center gap-2"><s.icon className="w-5 h-5 text-orange-500 flex-shrink-0" /> {s.titel}</p>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{s.text}</p>
            {s.tipp && <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg px-3 py-2">💡 {s.tipp}</p>}
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 flex items-start gap-3">
        <Users className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <p><strong className="text-slate-800">Wer darf was?</strong> Mechaniker legen Aufträge an, stempeln Zeit und machen Fotos. Rechnungen, Buchhaltung, Export und Einstellungen sehen nur Administratoren und Buchhalter; die Datensicherung nur Administratoren.</p>
      </div>
    </div>
  )
}
