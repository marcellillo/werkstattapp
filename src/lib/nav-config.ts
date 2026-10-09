// Gemeinsame Menü-Definition für Seitenleiste (Desktop) und untere Leiste/Menü (Handy).
// Das Tagesgeschäft steht oben (7 Punkte); alles Seltene liegt unter "Weitere Funktionen".
// Berechtigungen kommen weiter über `key` (rollen-context), optionale Feature-Schalter über `feature`.
import {
  LayoutDashboard, Car, Wrench, Layers, CalendarClock, Users, BookOpen,
  ClipboardCheck, Package, PackagePlus, Droplets, Calendar, ShieldAlert, Receipt, Mail, Bell, BarChart2, History,
  type LucideIcon,
} from 'lucide-react'
import type { FeatureName } from '@/lib/feature-flags'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  key: string
  feature?: FeatureName
  badge?: 'benachrichtigungen'
  /** Wann gilt der Eintrag als aktiv? (Pfad + ?tab=…) */
  aktiv: (pathname: string, tab: string | null) => boolean
}

const startet = (pfad: string, basis: string) => pfad === basis || pfad.startsWith(basis + '/')
const EIGEN_UNTERSEITEN = ['/fahrzeuge/bestand', '/fahrzeuge/verkauft', '/fahrzeuge/uebergeben']

export const NAV_HAUPT: NavItem[] = [
  {
    href: '/dashboard', label: 'Heute', icon: LayoutDashboard, key: 'dashboard',
    aktiv: (p) => startet(p, '/dashboard'),
  },
  {
    href: '/fahrzeuge?tab=fremd', label: 'Aufträge', icon: Wrench, key: 'fahrzeuge',
    // Kundenaufträge + TÜV-/Service-Ansicht + alle Auftragsseiten (Detail, Mappe, Rechnung …)
    aktiv: (p, tab) => {
      if (EIGEN_UNTERSEITEN.some(u => startet(p, u))) return false
      if (p === '/fahrzeuge') return tab === 'fremd' || tab === 'tuev' || tab === 'service'
      return startet(p, '/fahrzeuge')
    },
  },
  {
    href: '/fahrzeuge?tab=eigen', label: 'Eigenfahrzeuge', icon: Car, key: 'fahrzeuge',
    aktiv: (p, tab) => (p === '/fahrzeuge' && (tab === null || tab === 'eigen')) || EIGEN_UNTERSEITEN.some(u => startet(p, u)),
  },
  { href: '/hebebuehnen', label: 'Hebebühnen', icon: Layers, key: 'hebebuehnen', aktiv: (p) => startet(p, '/hebebuehnen') },
  { href: '/termine', label: 'Termine', icon: CalendarClock, key: 'termine', aktiv: (p) => startet(p, '/termine') },
  { href: '/kunden', label: 'Kunden', icon: Users, key: 'kunden', aktiv: (p) => startet(p, '/kunden') },
  { href: '/buchhaltung', label: 'Buchhaltung', icon: BookOpen, key: 'buchhaltung', aktiv: (p) => startet(p, '/buchhaltung') },
]

export const NAV_MEHR: { label: string; items: NavItem[] }[] = [
  {
    label: 'Werkstatt',
    items: [
      { href: '/annahme', label: 'Annahme-Übersicht', icon: ClipboardCheck, key: 'fahrzeuge', aktiv: (p) => startet(p, '/annahme') },
      { href: '/teile', label: 'Lager', icon: Package, key: 'teile', feature: 'teile_bestellen', aktiv: (p) => startet(p, '/teile') },
      { href: '/betriebsstoffe', label: 'Betriebsstoffe', icon: Droplets, key: 'betriebsstoffe', aktiv: (p) => startet(p, '/betriebsstoffe') },
      { href: '/leistungspakete', label: 'Leistungspakete', icon: PackagePlus, key: 'einstellungen', aktiv: (p) => startet(p, '/leistungspakete') },
    ],
  },
  {
    label: 'Termine & Erinnerungen',
    items: [
      { href: '/kalender', label: 'Kalender', icon: Calendar, key: 'kalender', feature: 'kalender', aktiv: (p) => startet(p, '/kalender') },
      { href: '/tuev-wecker', label: 'TÜV-Wecker', icon: ShieldAlert, key: 'tuev_wecker', aktiv: (p) => startet(p, '/tuev-wecker') },
      { href: '/service-wecker', label: 'Service-Wecker', icon: Wrench, key: 'service_wecker', aktiv: (p) => startet(p, '/service-wecker') },
    ],
  },
  {
    label: 'Büro',
    items: [
      { href: '/rechnungen', label: 'Eingangsrechnungen', icon: Receipt, key: 'rechnungen', aktiv: (p) => startet(p, '/rechnungen') },
      { href: '/emails', label: 'E-Mails', icon: Mail, key: 'emails', aktiv: (p) => startet(p, '/emails') },
      { href: '/benachrichtigungen', label: 'Benachrichtigungen', icon: Bell, key: 'benachrichtigungen', badge: 'benachrichtigungen', aktiv: (p) => startet(p, '/benachrichtigungen') },
      { href: '/statistiken', label: 'Statistiken', icon: BarChart2, key: 'statistiken', aktiv: (p) => startet(p, '/statistiken') },
      { href: '/verlauf', label: 'Verlauf', icon: History, key: 'verlauf', aktiv: (p) => startet(p, '/verlauf') },
    ],
  },
]

export const NAV_ALLE_MEHR: NavItem[] = NAV_MEHR.flatMap(g => g.items)

export function sichtbar(
  item: NavItem,
  kannZugreifen: (key: string) => boolean,
  isFeatureEnabled: (f: FeatureName) => boolean,
): boolean {
  return kannZugreifen(item.key) && (!item.feature || isFeatureEnabled(item.feature))
}
