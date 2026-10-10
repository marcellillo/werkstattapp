'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Car, User, Wrench, Package, Calendar, Plus, Trash2, CheckCircle, Clock, Circle, ChevronRight, ShieldCheck, Search, Printer, Receipt, Ban, UserCheck, ClipboardCheck, X, MessageSquare, Mail, Phone, Camera, FolderOpen, Share2, Copy, Check, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import {
  type Auftrag, type Hebebuehne, type Ersatzteil,
  type FahrzeugStatus, type TeilStatus,
  FAHRZEUG_STATUS_LABEL, FAHRZEUG_STATUS_COLOR,
  TEIL_STATUS_LABEL, TEIL_STATUS_COLOR,
} from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { createRechnungOnAusgeliefert } from '@/lib/auto-rechnung-ersteller'
import { VerkaufenModal } from './verkaufen-modal'
import { generatePvKompassLink } from '@/lib/pv-kompass-link'
import { SupplierInvoices } from './supplier-invoices'
import { KostenvoranschlagSection } from './kostenvoranschlag-section'
import { WerkstattauftragSection } from './werkstattauftrag-section'
import { RechnungSection } from './rechnung-section'
import { VorgangLeiste } from './vorgang-leiste'
import { LieferscheinQuickScan } from '@/components/lieferschein-quick-scan'
import { LieferscheinGalerie } from '@/components/lieferschein-galerie'
import { AuftragDokumente } from '@/components/auftrag-dokumente'
import { waNummer } from '@/lib/kontakt'

interface Props {
  auftrag: Auftrag
  hebebuehnen: Hebebuehne[]
  historie: any[]
  googleBewertungUrl?: string
  standardSteuerart?: 'differenz' | 'regel' | 'ausfuhr'
  betriebId: string
}

const STATUS_ORDER_FREMD: FahrzeugStatus[] = [
  'angenommen', 'diagnose', 'reparatur', 'warten_teile', 'fertig', 'ausgeliefert'
]
const STATUS_ORDER_EIGEN: FahrzeugStatus[] = [
  'angenommen', 'fertig', 'verkauft', 'ausgeliefert'
]

const TEIL_STATUS_ORDER: TeilStatus[] = [
  'nicht_bestellt', 'bestellt', 'unterwegs', 'geliefert', 'eingebaut'
]

interface TeilVorschlag {
  bezeichnung: string
  teilenummer: string | null
  lieferant: string | null
  einzelpreis: number | null
}

export function FahrzeugDetail({ auftrag: initialAuftrag, hebebuehnen, historie, googleBewertungUrl = '', standardSteuerart = 'differenz', betriebId }: Props) {
  const [auftrag, setAuftrag] = useState(initialAuftrag)
  const [dokumenteRefresh, setDokumenteRefresh] = useState(0)
  const [teile, setTeile] = useState<Ersatzteil[]>((initialAuftrag.ersatzteile as Ersatzteil[]) ?? [])
  const [saving, setSaving] = useState(false)
  const [newTeil, setNewTeil] = useState({ bezeichnung: '', teilenummer: '', lieferant: '', menge: 1, einzelpreis: '' })
  const [showAddTeil, setShowAddTeil] = useState(false)
  const [teilVorschlaege, setTeilVorschlaege] = useState<TeilVorschlag[]>([])
  const [suchbegriff, setSuchbegriff] = useState('')
  const [showVorschlaege, setShowVorschlaege] = useState(false)
  const suchRef = useRef<HTMLDivElement>(null)
  const [arbeiten, setArbeiten] = useState(initialAuftrag.arbeiten ?? '')
  const [fertigDatum, setFertigDatum] = useState(initialAuftrag.geplante_fertigstellung ?? '')
  const [dauerTage, setDauerTage] = useState(initialAuftrag.geschaetzte_dauer_tage != null ? String(initialAuftrag.geschaetzte_dauer_tage) : '')
  const [tuevKandidat, setTuevKandidat] = useState(initialAuftrag.tuev_kandidat ?? false)
  const [tuevTermin, setTuevTermin] = useState(initialAuftrag.tuev_termin ?? '')
  const [tuevErgebnis, setTuevErgebnis] = useState(initialAuftrag.tuev_ergebnis ?? '')
  const fz = initialAuftrag.fahrzeug as any
  const [naechsteHu, setNaechsteHu] = useState<string>((fz?.naechste_hauptuntersuchung ?? ''))
  const [naechsterService, setNaechsterService] = useState<string>((fz?.naechster_service_datum ?? ''))
  const [savingService, setSavingService] = useState(false)
  const [buehneWarnung, setBuehneWarnung] = useState<FahrzeugStatus | null>(null)
  const [buehneWahl, setBuehneWahl] = useState('')
  const [kvRefreshSignal, setKvRefreshSignal] = useState(0)
  const [dokumenteBlockKey, setDokumenteBlockKey] = useState(0)   // erzwingt Neuladen von Kostenvoranschlag/Werkstattauftrag/Rechnungen
  const [fertigEmailStatus, setFertigEmailStatus] = useState<'idle' | 'senden' | 'ok' | 'fehler'>('idle')
  const [storniereBestaetigung, setStorniereBestaetigung] = useState(false)
  const [stornieren, setStornieren] = useState(false)
  const [mitarbeiter, setMitarbeiter] = useState<any[]>([])
  const [zugewiesenAn, setZugewiesenAn] = useState<string>(initialAuftrag.zugewiesen_an ?? '')
  const [checklisteZiel, setChecklisteZiel] = useState<FahrzeugStatus | null>(null)
  const [checklisteAbgehakt, setChecklisteAbgehakt] = useState<Record<string, boolean>>({})
  const [verkaufspreis, setVerkaufspreis] = useState('')
  // Steuerart wird still auf Standard (aus Einstellungen) gesetzt bzw. bestehende Einstufung erhalten — Feinjustierung im Steuerblatt
  const [detailSteuerart] = useState<'differenz' | 'regel' | 'ausfuhr'>((auftrag as any).steuerart ?? standardSteuerart)
  const [showKundeModal, setShowKundeModal] = useState(false)
  const [kundeSearch, setKundeSearch] = useState('')
  const [kundenListe, setKundenListe] = useState<any[]>([])
  const [kundeZuweisenLoading, setKundeZuweisenLoading] = useState(false)
  const [loeschenBestaetigung, setLoeschenBestaetigung] = useState(false)
  const [loeschen, setLoeschen] = useState(false)
  const [loeschenFehler, setLoeschenFehler] = useState<string | null>(null)
  const [linkKopiert, setLinkKopiert] = useState(false)
  const [showUebergabe, setShowUebergabe] = useState(false)
  const [uebergabeKm, setUebergabeKm] = useState('')
  const [uebergabeTank, setUebergabeTank] = useState(50)
  const [uebergabeSchaeden, setUebergabeSchaeden] = useState('')
  const [uebergabeZustand, setUebergabeZustand] = useState('gut')
  const [uebergabeSaving, setUebergabeSaving] = useState(false)
  const [showBewertungModal, setShowBewertungModal] = useState(false)
  const [showVerkaufenModal, setShowVerkaufenModal] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const isEigenfahrzeug = (auftrag.fahrzeug as any)?.fahrzeug_typ === 'eigen'

  // Vom Board aus geöffnet (?aktion=…): den passenden Schritt einmalig anstoßen (Bühnen-Frage, Checkliste, …)
  const aktionGestartet = useRef(false)
  useEffect(() => {
    if (aktionGestartet.current) return
    const aktion = new URLSearchParams(window.location.search).get('aktion')
    if (!aktion) return
    aktionGestartet.current = true
    window.history.replaceState(null, '', window.location.pathname)
    if (['reparatur', 'fertig', 'ausgeliefert'].includes(aktion) && auftrag.status !== aktion) handleStatusChange(aktion as FahrzeugStatus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Kommt die Frage "Auf welcher Bühne steht das Fahrzeug?" (z. B. nach dem Knopf in der Vorgangs-Leiste), dorthin scrollen
  useEffect(() => {
    if (buehneWarnung) setTimeout(() => document.getElementById('buehne-warnung')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
  }, [buehneWarnung])

  const CHECKLISTE_FERTIG = isEigenfahrzeug ? [
    { id: 'arbeiten', label: 'Alle Aufbereitungsarbeiten erledigt' },
    { id: 'teile', label: 'Alle Ersatzteile verbaut' },
    { id: 'sauber', label: 'Fahrzeug wurde gereinigt / poliert' },
    { id: 'fotos', label: 'Fotos für Inserat erstellt' },
  ] : [
    { id: 'arbeiten', label: 'Alle Arbeiten wurden erledigt' },
    { id: 'teile', label: 'Alle Ersatzteile sind verbaut' },
    { id: 'sauber', label: 'Fahrzeug wurde gereinigt' },
    { id: 'rechnung', label: 'Rechnung wurde erstellt' },
    { id: 'schluessel', label: 'Fahrzeugschlüssel sind bereit' },
  ]
  // Für Eigenfahrzeuge: Schritt 1 = Kaufvertrag unterschrieben
  const CHECKLISTE_VERKAUFT = [
    { id: 'vertrag', label: 'Kaufvertrag unterschrieben' },
    { id: 'anzahlung', label: 'Anzahlung / Zahlung bestätigt' },
    { id: 'termin', label: 'Übergabetermin vereinbart' },
  ]
  const CHECKLISTE_AUSGELIEFERT = isEigenfahrzeug ? [
    { id: 'zahlung', label: 'Zahlung vollständig erhalten' },
    { id: 'schluessel', label: 'Schlüssel wurden übergeben' },
    { id: 'papiere', label: 'Fahrzeugpapiere übergeben' },
  ] : [
    { id: 'uebergabe', label: 'Fahrzeug wurde an Kunden übergeben' },
    { id: 'bezahlt', label: 'Rechnung wurde bezahlt' },
    { id: 'schluessel', label: 'Schlüssel wurden übergeben' },
    { id: 'papiere', label: 'Fahrzeugpapiere wurden übergeben' },
  ]

  // Lade Mitarbeiter
  useEffect(() => {
    let mounted = true
    supabase.from('profiles').select('id, full_name, role').order('full_name')
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.error('Fehler beim Laden von Mitarbeitern:', error)
          return
        }
        if (data) setMitarbeiter(data)
      })
    return () => { mounted = false }
  }, [])

  async function handleMitarbeiterChange(profileId: string) {
    setZugewiesenAn(profileId)
    await supabase.from('auftraege').update({ zugewiesen_an: profileId || null }).eq('id', auftrag.id)
  }

  // Lade bekannte Teile aus der DB für Autocomplete
  useEffect(() => {
    supabase
      .from('ersatzteile')
      .select('bezeichnung, teilenummer, lieferant, einzelpreis')
      .order('bezeichnung')
      .then(({ data }) => {
        if (!data) return
        // Deduplizieren nach Bezeichnung+Teilenummer, neuester Preis gewinnt
        const map = new Map<string, TeilVorschlag>()
        for (const t of data) {
          const key = `${t.bezeichnung}||${t.teilenummer ?? ''}`
          if (!map.has(key)) map.set(key, t as TeilVorschlag)
        }
        setTeilVorschlaege(Array.from(map.values()))
      })
  }, [])

  // Klick außerhalb schließt Vorschlagsliste
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (suchRef.current && !suchRef.current.contains(e.target as Node)) {
        setShowVorschlaege(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const gefilterteVorschlaege = useMemo(() => {
    if (!suchbegriff.trim()) return teilVorschlaege.slice(0, 8)
    const q = suchbegriff.toLowerCase()
    return teilVorschlaege
      .filter(t =>
        t.bezeichnung.toLowerCase().includes(q) ||
        (t.teilenummer ?? '').toLowerCase().includes(q) ||
        (t.lieferant ?? '').toLowerCase().includes(q)
      )
      .slice(0, 10)
  }, [suchbegriff, teilVorschlaege])

  function vorschlagWaehlen(v: TeilVorschlag) {
    setNewTeil(p => ({
      ...p,
      bezeichnung: v.bezeichnung,
      teilenummer: v.teilenummer ?? '',
      lieferant: v.lieferant ?? '',
      einzelpreis: v.einzelpreis != null ? String(v.einzelpreis) : '',
    }))
    setSuchbegriff(v.bezeichnung)
    setShowVorschlaege(false)
  }

  async function saveArbeiten() {
    setSaving(true)
    try {
      await supabase.from('auftraege').update({
        arbeiten,
        geplante_fertigstellung: fertigDatum || null,
        geschaetzte_dauer_tage: dauerTage ? parseFloat(dauerTage) : null,
      }).eq('id', auftrag.id)
    } catch (err) {
      console.error('Fehler beim Speichern der Arbeiten:', err)
    } finally {
      setSaving(false)
    }
  }

  // Heute + N Werktage (Wochenenden überspringen)
  function berechneFertigDatum(tage: number): string {
    const d = new Date()
    let verbleibend = Math.ceil(tage)
    while (verbleibend > 0) {
      d.setDate(d.getDate() + 1)
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) verbleibend--
    }
    return d.toISOString().split('T')[0]
  }

  function dauerWaehlen(tage: string) {
    setDauerTage(tage)
    const n = parseFloat(tage)
    if (!isNaN(n) && n > 0) setFertigDatum(berechneFertigDatum(n))
  }

  async function saveTuev() {
    let neueNaechsteHu = naechsteHu
    if (tuevErgebnis === 'bestanden' && tuevTermin) {
      const [y, m, d] = tuevTermin.split('-')
      neueNaechsteHu = `${parseInt(y) + 2}-${m}-${d}`
      setNaechsteHu(neueNaechsteHu)
    }
    await supabase.from('auftraege').update({
      tuev_kandidat: tuevKandidat,
      tuev_termin: tuevTermin || null,
      tuev_ergebnis: tuevErgebnis || null,
    }).eq('id', auftrag.id)
    if (neueNaechsteHu) {
      await supabase.from('fahrzeuge').update({
        naechste_hauptuntersuchung: neueNaechsteHu,
        tuev_erinnerung: true,
      }).eq('id', (auftrag.fahrzeug as any)?.id)
    }
  }

  async function saveServiceDaten() {
    setSavingService(true)
    await supabase.from('fahrzeuge').update({
      naechste_hauptuntersuchung: naechsteHu || null,
      naechster_service_datum: naechsterService || null,
    }).eq('id', (auftrag.fahrzeug as any)?.id)
    setSavingService(false)
  }

  async function handleStatusChange(status: FahrzeugStatus) {
    if ((status === 'diagnose' || status === 'reparatur') && !auftrag.hebebuehne_id) {
      setBuehneWarnung(status)
      return
    }
    // Checkliste vor Fertig / Verkauft (Eigen) / Ausgeliefert
    const brauchtCheckliste = status === 'fertig' || status === 'ausgeliefert' ||
      (status === 'verkauft' && isEigenfahrzeug)
    if (brauchtCheckliste) {
      setChecklisteZiel(status)
      setChecklisteAbgehakt({})
      return
    }
    setBuehneWarnung(null)
    try {
      const { error } = await supabase.from('auftraege').update({ status }).eq('id', auftrag.id)
      if (error) throw error
      setAuftrag(a => ({ ...a, status }))
      fetch('/api/benachrichtigungen/generieren', { method: 'POST' }).catch(err => console.warn('Benachrichtigung fehlgeschlagen:', err))
    } catch (err) {
      console.error('Fehler beim Status-Update:', err)
    }
  }

  async function handleChecklisteBestaetigen() {
    if (!checklisteZiel) return
    const status = checklisteZiel
    setChecklisteZiel(null)
    setBuehneWarnung(null)
    setAuftrag(a => ({ ...a, status }))
    const updates: Record<string, any> = { status }
    if (status === 'fertig') updates.fertiggestellt_am = new Date().toISOString().split('T')[0]
    if (status === 'verkauft' && isEigenfahrzeug) {
      updates.verkauft_am = new Date().toISOString().split('T')[0]
      updates.steuerart = detailSteuerart // Standard §25a bzw. bestehende Einstufung
      const preis = parseFloat(verkaufspreis.replace(',', '.'))
      if (!isNaN(preis) && preis > 0) updates.einnahmen = preis
      setVerkaufspreis('')
    }
    // Keine auto-Rechnung in fahrzeug-detail — das passiert in /fahrzeuge/verkauft
    await supabase.from('auftraege').update(updates).eq('id', auftrag.id)
    fetch('/api/benachrichtigungen/generieren', { method: 'POST' }).catch(() => {})
    if (status === 'fertig') {
      const kz = auftrag.fahrzeug?.kennzeichen ?? ''
      const name = `${auftrag.fahrzeug?.marke ?? ''} ${auftrag.fahrzeug?.modell ?? ''}`.trim()
      fetch('/api/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '✅ Auftrag fertig', body: `${name} (${kz}) ist fertig zur Abholung`, url: `/fahrzeuge/${auftrag.id}`, tag: 'fertig' })
      }).catch(err => console.warn('Push-Benachrichtigung fehlgeschlagen:', err))
      const a = auftrag as any
      setUebergabeKm(String(a.annahme_km ?? ''))
      setUebergabeTank(a.annahme_tank ?? 50)
      setUebergabeSchaeden('')
      setUebergabeZustand('gut')
      setShowUebergabe(true)
    }
    if (status === 'ausgeliefert' && !isEigenfahrzeug) {
      setShowBewertungModal(true)
    }
  }

  async function handleUebergabeSpeichern(ueberspringen = false) {
    if (!ueberspringen) {
      setUebergabeSaving(true)
      await supabase.from('auftraege').update({
        uebergabe_km: uebergabeKm ? parseInt(uebergabeKm) : null,
        uebergabe_tank: uebergabeTank,
        uebergabe_schaeden: uebergabeSchaeden || null,
        uebergabe_zustand: uebergabeZustand,
        uebergabe_datum: new Date().toISOString(),
      }).eq('id', auftrag.id)
      setUebergabeSaving(false)
    }
    setShowUebergabe(false)
  }

  async function ladeKunden(search: string) {
    let q = supabase.from('kunden').select('id, vorname, nachname, firma, telefon, mobil').order('nachname')
    if (search.trim()) {
      q = q.or(`vorname.ilike.%${search}%,nachname.ilike.%${search}%,firma.ilike.%${search}%`)
    }
    const { data } = await q.limit(20)
    setKundenListe(data ?? [])
  }

  async function handleKundeZuweisen(kundeId: string) {
    setKundeZuweisenLoading(true)
    const { data: updatedAuftrag } = await supabase
      .from('auftraege')
      .update({ kunden_id: kundeId })
      .eq('id', auftrag.id)
      .select('*, fahrzeug:fahrzeuge(*), kunde:kunden(*), ersatzteile(*)')
      .single()
    if (updatedAuftrag) setAuftrag(updatedAuftrag as any)
    setKundeZuweisenLoading(false)
    setShowKundeModal(false)
    setKundeSearch('')
    setKundenListe([])
  }

  async function handleStornieren() {
    setStornieren(true)
    try {
      // Teile zurück ins Lager (geliefert), außer nicht_bestellt
      const teileZurueck = teile.filter(t => t.status !== 'nicht_bestellt')
      if (teileZurueck.length > 0) {
        await supabase.from('ersatzteile')
          .update({ status: 'geliefert' })
          .in('id', teileZurueck.map(t => t.id))
        setTeile(prev => prev.map(t => t.status !== 'nicht_bestellt' ? { ...t, status: 'geliefert' } : t))
      }
      // Auftrag stornieren + Bühne freigeben
      await supabase.from('auftraege')
        .update({ status: 'storniert', hebebuehne_id: null })
        .eq('id', auftrag.id)
      setAuftrag(a => ({ ...a, status: 'storniert', hebebuehne_id: undefined, hebebuehne: undefined }))
      setStorniereBestaetigung(false)
    } catch (err) {
      console.error('Fehler beim Stornieren:', err)
    } finally {
      setStornieren(false)
    }
  }

  async function handleLoeschen() {
    setLoeschen(true)
    setLoeschenFehler(null)
    try {
      // Teile löschen
      const { error: teileError } = await supabase.from('ersatzteile').delete().eq('auftrag_id', auftrag.id)
      if (teileError) throw teileError
      // Fotos löschen
      const { error: fotosError } = await supabase.from('auftrag_fotos').delete().eq('auftrag_id', auftrag.id)
      if (fotosError) throw fotosError
      // Auftrag löschen -- count prüfen, weil eine RLS-Policy nicht erlaubte Zeilen
      // einfach unsichtbar macht (0 betroffene Zeilen) statt einen Fehler zu werfen
      const { error: auftragError, count } = await supabase
        .from('auftraege')
        .delete({ count: 'exact' })
        .eq('id', auftrag.id)
      if (auftragError) throw auftragError
      if (!count) throw new Error('Keine Berechtigung zum Löschen dieses Auftrags.')
      // Gespeicherte Dokument-Dateien (PDF/Bilder) mit entfernen -- die Datenbankzeilen sind per CASCADE schon weg
      await fetch('/api/auftrag-dokument/aufraeumen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auftragId: auftrag.id }),
      }).catch(() => {})
      router.push('/fahrzeuge')
    } catch (err: any) {
      console.error('Fehler beim Löschen:', err)
      setLoeschenFehler(
        err?.code === '23503'
          ? 'Dieser Auftrag kann nicht gelöscht werden, da noch Rechnungen oder andere Dokumente damit verknüpft sind.'
          : (err?.message || 'Löschen fehlgeschlagen.')
      )
      setLoeschen(false)
    }
  }

  async function handleBuehneUndStatus(hebebuehne_id: string) {
    if (!hebebuehne_id || !buehneWarnung) return
    const hebebuehne = hebebuehnen.find(h => h.id === hebebuehne_id) ?? undefined
    const status = buehneWarnung
    setBuehneWarnung(null)
    setAuftrag(a => ({ ...a, hebebuehne_id, hebebuehne, status }))
    await supabase.from('auftraege').update({ hebebuehne_id, status }).eq('id', auftrag.id)
  }

  async function handleBuehneChange(hebebuehne_id: string) {
    const hebebuehne = hebebuehnen.find(h => h.id === hebebuehne_id) ?? undefined
    setAuftrag(a => ({ ...a, hebebuehne_id: hebebuehne_id || undefined, hebebuehne }))
    await supabase.from('auftraege').update({
      hebebuehne_id: hebebuehne_id || null
    }).eq('id', auftrag.id)
  }

  async function handleTeilStatusChange(teilId: string, status: TeilStatus) {
    const teil = teile.find(t => t.id === teilId)
    const updatedTeile = teile.map(t => t.id === teilId ? { ...t, status } : t)
    setTeile(updatedTeile)
    await supabase.from('ersatzteile').update({ status }).eq('id', teilId)

    if (status === 'geliefert' && teil) {
      const kz = auftrag.fahrzeug?.kennzeichen ?? ''
      fetch('/api/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '📦 Teil eingetroffen', body: `${teil.bezeichnung} für ${kz} ist angekommen`, url: `/fahrzeuge/${auftrag.id}`, tag: 'teil' })
      }).catch(err => console.warn('Push-Benachrichtigung für Teil fehlgeschlagen:', err))
    }

    // Auto-auf-fertig setzen wenn alle Teile eingebaut sind
    if (status === 'eingebaut') {
      const allEingebaut = updatedTeile.length > 0 && updatedTeile.every(t => t.status === 'eingebaut')
      if (allEingebaut && auftrag.status !== 'fertig' && auftrag.status !== 'ausgeliefert') {
        setAuftrag(a => ({ ...a, status: 'fertig' }))
        await supabase.from('auftraege').update({ status: 'fertig', fertiggestellt_am: new Date().toISOString().split('T')[0] }).eq('id', auftrag.id)
        fetch('/api/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '✅ Auftrag fertig!', body: `${auftrag.fahrzeug?.marke ?? ''} ${auftrag.fahrzeug?.modell ?? ''} ist fertig zur Abholung`, url: `/fahrzeuge/${auftrag.id}`, tag: 'fertig' })
        }).catch(err => console.warn('Push-Benachrichtigung fehlgeschlagen:', err))
      }
    }
  }

  async function handleAddTeil() {
    if (!newTeil.bezeichnung.trim()) return
    const insert = {
      betrieb_id: betriebId,
      auftrag_id: auftrag.id,
      bezeichnung: newTeil.bezeichnung,
      teilenummer: newTeil.teilenummer || null,
      lieferant: newTeil.lieferant || null,
      menge: newTeil.menge,
      einzelpreis: newTeil.einzelpreis ? parseFloat(newTeil.einzelpreis) : null,
      status: 'nicht_bestellt' as TeilStatus,
    }
    const { data, error } = await supabase.from('ersatzteile').insert(insert).select().single()
    if (error) { console.error('Ersatzteil-Insert fehlgeschlagen:', error); alert(`Teil konnte nicht gespeichert werden: ${error.message}`); return }
    if (data) {
      setTeile(prev => [...prev, data as Ersatzteil])
      setNewTeil({ bezeichnung: '', teilenummer: '', lieferant: '', menge: 1, einzelpreis: '' })
      setSuchbegriff('')
      setShowAddTeil(false)
    }
  }

  async function handleAddTeilUndBestellen() {
    if (!newTeil.bezeichnung.trim()) return
    try {
      const insert = {
        betrieb_id: betriebId,
        auftrag_id: auftrag.id,
        bezeichnung: newTeil.bezeichnung.trim(),
        teilenummer: newTeil.teilenummer || null,
        lieferant: newTeil.lieferant || null,
        menge: newTeil.menge,
        einzelpreis: newTeil.einzelpreis ? parseFloat(newTeil.einzelpreis) : null,
        status: 'bestellt' as TeilStatus,
        bestellt_am: new Date().toISOString().split('T')[0],
      }
      const { data, error } = await supabase.from('ersatzteile').insert(insert).select().single()
      if (error) throw error
      if (data) {
        setTeile(prev => [...prev, data as Ersatzteil])
        setNewTeil({ bezeichnung: '', teilenummer: '', lieferant: '', menge: 1, einzelpreis: '' })
        setSuchbegriff('')
        setShowAddTeil(false)
      }
    } catch (err: any) {
      console.error('Fehler beim Speichern des bestellten Teils:', err)
      alert(`Teil konnte nicht gespeichert werden: ${err.message ?? err}`)
    }
  }

  async function handleDeleteTeil(teilId: string) {
    setTeile(prev => prev.filter(t => t.id !== teilId))
    await supabase.from('ersatzteile').delete().eq('id', teilId)
  }

  const fahrzeug = auftrag.fahrzeug
  const kunde = auftrag.kunde
  const overdue = auftrag.geplante_fertigstellung &&
    auftrag.geplante_fertigstellung < new Date().toISOString().split('T')[0] &&
    !['fertig', 'ausgeliefert'].includes(auftrag.status)

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Back + Header */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/fahrzeuge">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Zurück
          </Button>
        </Link>
        {auftrag.status === 'storniert' && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
            <Ban className="w-3.5 h-3.5" /> Storniert
          </span>
        )}
      </div>

      {/* Vorgang: wo steht der Auftrag, was ist der nächste Schritt? */}
      <VorgangLeiste
        auftragId={auftrag.id}
        fahrzeugId={(auftrag.fahrzeug as any)?.id}
        betriebId={betriebId}
        status={auftrag.status}
        istEigenfahrzeug={isEigenfahrzeug}
        aktualisierung={kvRefreshSignal}
        onStatus={handleStatusChange}
        onVerkaufen={() => setShowVerkaufenModal(true)}
        onKostenvoranschlagErstellt={() => { setKvRefreshSignal(n => n + 1); setDokumenteBlockKey(n => n + 1) }}
        onPaketUebernommen={() => { setKvRefreshSignal(n => n + 1); setDokumenteBlockKey(n => n + 1) }}
        kunde={auftrag.kunde}
        fahrzeugName={`${(auftrag.fahrzeug as any)?.marke ?? ''} ${(auftrag.fahrzeug as any)?.modell ?? ''}`.trim()}
      />

      {/* Schnellaktionen */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/fahrzeuge/${auftrag.id}/mappe`} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-300 transition-colors font-semibold text-sm">
          <FolderOpen className="w-4 h-4 flex-shrink-0" /> Auftragsmappe
        </Link>
        <Link href={`/fahrzeuge/${auftrag.id}/annahme`} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors text-xs sm:text-sm">
          <ClipboardCheck className="w-4 h-4 flex-shrink-0" /> Annahmeprotokoll
        </Link>
        <Link href={`/fahrzeuge/${auftrag.id}/fotos`} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-colors text-xs sm:text-sm">
          <Camera className="w-4 h-4 flex-shrink-0" /> Fotos
        </Link>
        <a href="#dokumente" className="flex items-center gap-2 px-3 py-2 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-300 transition-colors text-xs sm:text-sm">
          <FileText className="w-4 h-4 flex-shrink-0" /> Dokumente (PDF)
        </a>
        <Link href={`/fahrzeuge/${auftrag.id}/protokoll`} target="_blank" className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors text-xs sm:text-sm">
          <Printer className="w-4 h-4 flex-shrink-0" /> Werkstattprotokoll
        </Link>
        <Link href={`/fahrzeuge/${auftrag.id}/rechnung`} target="_blank" className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300 transition-colors text-xs sm:text-sm">
          <Receipt className="w-4 h-4 flex-shrink-0" /> Rechnung
        </Link>
        <button
          onClick={async () => {
            const url = `${window.location.origin}/status/${auftrag.id}`
            if (navigator.share) {
              navigator.share({ title: `Auftragsstatus – ${(auftrag.fahrzeug as any)?.kennzeichen ?? ''}`, url })
            } else {
              await navigator.clipboard.writeText(url)
              setLinkKopiert(true)
              setTimeout(() => setLinkKopiert(false), 2500)
            }
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 hover:border-teal-300 transition-colors text-xs sm:text-sm"
        >
          {linkKopiert ? <Check className="w-4 h-4 flex-shrink-0" /> : <Share2 className="w-4 h-4 flex-shrink-0" />}
          {linkKopiert ? 'Link kopiert!' : 'Status-Link'}
        </button>
      </div>

      {/* Checkliste vor Fertig / Ausgeliefert */}
      {checklisteZiel && (() => {
        const items = checklisteZiel === 'fertig'
          ? CHECKLISTE_FERTIG
          : checklisteZiel === 'verkauft'
            ? CHECKLISTE_VERKAUFT
            : CHECKLISTE_AUSGELIEFERT
        const alleAbgehakt = items.every(i => checklisteAbgehakt[i.id])
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <ClipboardCheck className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">
                      {checklisteZiel === 'fertig'
                        ? (isEigenfahrzeug ? 'Aufbereitung abschließen' : 'Fahrzeug fertigstellen')
                        : checklisteZiel === 'verkauft'
                          ? 'Kaufvertrag bestätigen'
                          : (isEigenfahrzeug ? 'Übergabe durchführen' : 'Fahrzeug ausliefern')}
                    </h3>
                    <p className="text-sm text-gray-500">Bitte alles abhaken bevor du fortfährst</p>
                  </div>
                </div>
                <button onClick={() => setChecklisteZiel(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setChecklisteAbgehakt(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all',
                      checklisteAbgehakt[item.id]
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    )}
                  >
                    <div className={cn(
                      'w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                      checklisteAbgehakt[item.id]
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300'
                    )}>
                      {checklisteAbgehakt[item.id] && <CheckCircle className="w-4 h-4 text-white" />}
                    </div>
                    <span className={cn(
                      'font-medium text-sm',
                      checklisteAbgehakt[item.id] ? 'text-green-800 line-through decoration-green-400' : 'text-gray-800'
                    )}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>

              {isEigenfahrzeug && checklisteZiel === 'verkauft' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verkaufspreis (optional)</label>
                  <div className="relative">
                    <input
                      type="number" inputMode="decimal" placeholder="0,00"
                      value={verkaufspreis}
                      onChange={e => setVerkaufspreis(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Einkaufspreis & Steuerart (Standard §25a) danach gebündelt im Steuerblatt.</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setChecklisteZiel(null); setVerkaufspreis('') }}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleChecklisteBestaetigen}
                  disabled={!alleAbgehakt}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all',
                    alleAbgehakt
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                >
                  {alleAbgehakt
                    ? checklisteZiel === 'fertig'
                      ? (isEigenfahrzeug ? '✓ Aufbereitung abschließen' : '✓ Fertigstellen')
                      : checklisteZiel === 'verkauft'
                        ? '✓ Als verkauft markieren'
                        : (isEigenfahrzeug ? '✓ Übergabe abschließen' : '✓ Ausliefern')
                    : `Noch ${items.filter(i => !checklisteAbgehakt[i.id]).length} offen`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Übergabeprotokoll */}
      {showUebergabe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 my-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <ClipboardCheck className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Übergabeprotokoll</h3>
                  <p className="text-sm text-gray-500">{auftrag.fahrzeug?.marke} {auftrag.fahrzeug?.modell} · {auftrag.fahrzeug?.kennzeichen}</p>
                </div>
              </div>
              <button onClick={() => handleUebergabeSpeichern(true)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Kilometerstand */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Kilometerstand bei Abholung</label>
              <div className="relative">
                <input
                  type="number"
                  value={uebergabeKm}
                  onChange={e => setUebergabeKm(e.target.value)}
                  placeholder="z. B. 85000"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">km</span>
              </div>
              {(auftrag as any).annahme_km && (
                <p className="text-xs text-gray-400 mt-1">Bei Annahme: {((auftrag as any).annahme_km as number).toLocaleString('de-DE')} km
                  {uebergabeKm && parseInt(uebergabeKm) > (auftrag as any).annahme_km
                    ? ` · +${(parseInt(uebergabeKm) - (auftrag as any).annahme_km).toLocaleString('de-DE')} km gefahren`
                    : ''}
                </p>
              )}
            </div>

            {/* Tankstand */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tankstand</label>
              <div className="flex gap-2">
                {[0, 25, 50, 75, 100].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setUebergabeTank(v)}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all',
                      uebergabeTank === v
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-orange-300'
                    )}
                  >
                    {v === 0 ? 'Leer' : v === 25 ? '¼' : v === 50 ? '½' : v === 75 ? '¾' : 'Voll'}
                  </button>
                ))}
              </div>
            </div>

            {/* Zustand */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Fahrzeugzustand</label>
              <div className="grid grid-cols-4 gap-2">
                {(['sehr_gut', 'gut', 'maessig', 'schlecht'] as const).map(z => {
                  const labels: Record<string, string> = { sehr_gut: 'Sehr gut', gut: 'Gut', maessig: 'Mäßig', schlecht: 'Schlecht' }
                  const colors: Record<string, string> = { sehr_gut: 'border-green-500 bg-green-500 text-white', gut: 'border-blue-500 bg-blue-500 text-white', maessig: 'border-yellow-500 bg-yellow-500 text-white', schlecht: 'border-red-500 bg-red-500 text-white' }
                  return (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setUebergabeZustand(z)}
                      className={cn(
                        'py-2 rounded-xl border-2 text-xs font-bold transition-all',
                        uebergabeZustand === z ? colors[z] : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      )}
                    >
                      {labels[z]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Schäden / Anmerkungen */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Sichtbare Schäden / Anmerkungen</label>
              <textarea
                value={uebergabeSchaeden}
                onChange={e => setUebergabeSchaeden(e.target.value)}
                rows={3}
                placeholder="z. B. Kratzer hinten links, keine neuen Schäden …"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => handleUebergabeSpeichern(true)}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Überspringen
              </button>
              <button
                onClick={() => handleUebergabeSpeichern(false)}
                disabled={uebergabeSaving}
                className="flex-1 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
              >
                {uebergabeSaving ? 'Speichern …' : '✓ Protokoll speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bewertungs-WhatsApp-Modal */}
      {showBewertungModal && (() => {
        // Ohne hinterlegten Google-Link gibt es nichts zu verschicken (die frühere interne Bewertungsseite existiert nicht)
        const bewertungLink = googleBewertungUrl
        const kundeVorname = (auftrag.kunde as any)?.vorname ?? ''
        const kundeTelefon = ((auftrag.kunde as any)?.telefon ?? (auftrag.kunde as any)?.mobil ?? '').replace(/\D/g, '')
        const waText = encodeURIComponent(
          `Hallo ${kundeVorname},\n\nvielen Dank für Ihren Besuch! Wir würden uns sehr über eine Google-Bewertung freuen – das dauert nur 30 Sekunden:\n\n${bewertungLink}\n\nHerzlichen Dank! 🙏`
        )
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="bg-white rounded-t-2xl w-full max-w-lg shadow-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-base">⭐ Google-Bewertung anfragen</h3>
                <button onClick={() => setShowBewertungModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600">
                {auftrag.kunde
                  ? `${kundeVorname} ${(auftrag.kunde as any).nachname ?? ''} hat das Fahrzeug abgeholt. Jetzt um eine Google-Bewertung bitten?`
                  : 'Fahrzeug wurde abgeholt. Jetzt um eine Google-Bewertung bitten?'
                }
              </p>
              {googleBewertungUrl ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <span className="text-lg">🔍</span>
                  <p className="text-xs text-green-700 font-medium break-all">{googleBewertungUrl}</p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-700">Kein Google-Link hinterlegt – bitte unter Einstellungen den Link zur Google-Bewertung eintragen. Dann kann die Anfrage direkt verschickt werden.</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBewertungModal(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                >
                  {bewertungLink ? 'Überspringen' : 'Schließen'}
                </button>
                {!bewertungLink ? null : kundeTelefon ? (
                  <a
                    href={`https://wa.me/${kundeTelefon}?text=${waText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowBewertungModal(false)}
                    className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-bold text-center hover:bg-green-700 transition-colors"
                  >
                    📱 Per WhatsApp senden
                  </a>
                ) : (
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(bewertungLink)
                      setShowBewertungModal(false)
                    }}
                    className="flex-1 py-3 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition-colors"
                  >
                    🔗 Link kopieren
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Stornieren-Bestätigung */}
      {storniereBestaetigung && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Ban className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Auftrag stornieren?</h3>
                <p className="text-sm text-gray-500">Das kann rückgängig gemacht werden.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 space-y-1">
              <p className="font-medium">Folgendes passiert:</p>
              <p>• Der Auftrag wird als <strong>Storniert</strong> markiert</p>
              <p>• Die Bühne wird <strong>freigegeben</strong></p>
              {teile.filter(t => t.status !== 'nicht_bestellt').length > 0 && (
                <p>• <strong>{teile.filter(t => t.status !== 'nicht_bestellt').length} Teile</strong> kommen zurück ins Lager</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStorniereBestaetigung(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleStornieren}
                disabled={stornieren}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl text-sm font-medium text-white transition-colors"
              >
                {stornieren ? 'Wird storniert…' : 'Ja, stornieren'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Löschen-Bestätigung */}
      {loeschenBestaetigung && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Auftrag endgültig löschen?</h3>
                <p className="text-sm text-gray-500">Diese Aktion kann nicht rückgängig gemacht werden.</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 space-y-1">
              <p className="font-medium">Folgendes wird dauerhaft gelöscht:</p>
              <p>• Der Auftrag <strong>{auftrag.auftrag_nr}</strong></p>
              {teile.length > 0 && <p>• <strong>{teile.length} Ersatzteile</strong></p>}
              <p>• Alle Fotos und das Annahmeprotokoll</p>
            </div>
            {loeschenFehler && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {loeschenFehler}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setLoeschenBestaetigung(false); setLoeschenFehler(null) }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleLoeschen}
                disabled={loeschen}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl text-sm font-medium text-white transition-colors"
              >
                {loeschen ? 'Wird gelöscht…' : 'Ja, löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Left column */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Vehicle Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Car className="w-5 h-5 text-orange-500" />
                Fahrzeugdaten
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const urls: string[] = (() => { try { return (fahrzeug as any)?.bilder_urls ? JSON.parse((fahrzeug as any).bilder_urls) : [] } catch { return [] } })()
                if (urls.length === 0) return null
                return (
                  <div className="mb-4">
                    <div className="rounded-xl overflow-hidden h-52 bg-gray-100 mb-2">
                      <img src={urls[0]} alt="Fahrzeug" className="w-full h-full object-cover" />
                    </div>
                    {urls.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {urls.slice(1).map((url, i) => (
                          <img key={i} src={url} alt="" className="h-16 w-24 object-cover rounded-lg flex-shrink-0 border border-gray-200" />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
              <div className="flex items-center gap-4 mb-4">
                {!(fahrzeug as any)?.bilder_urls && (
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${(fahrzeug as any)?.fahrzeug_typ === 'eigen' ? 'bg-purple-100' : 'bg-orange-100'}`}>
                  <Car className={`w-8 h-8 ${(fahrzeug as any)?.fahrzeug_typ === 'eigen' ? 'text-purple-500' : 'text-orange-500'}`} />
                </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">
                      {fahrzeug?.marke} {fahrzeug?.modell}
                    </h2>
                    {(fahrzeug as any)?.fahrzeug_typ === 'eigen' && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Eigenfahrzeug</span>
                    )}
                  </div>
                  <p className="text-lg font-mono text-gray-600">{fahrzeug?.kennzeichen}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-600">{auftrag.auftrag_nr}</p>
                    {(fahrzeug as any)?.mobile_de_id && (
                      <span className="text-sm font-mono text-purple-600">{(fahrzeug as any).mobile_de_id}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {fahrzeug?.baujahr && (
                  <div>
                    <p className="text-gray-600 text-xs">Baujahr</p>
                    <p className="font-medium">{fahrzeug.baujahr}</p>
                  </div>
                )}
                {fahrzeug?.kilometerstand && (
                  <div>
                    <p className="text-gray-600 text-xs">Kilometerstand</p>
                    <p className="font-medium">{fahrzeug.kilometerstand.toLocaleString('de-DE')} km</p>
                  </div>
                )}
                {(fahrzeug as any)?.farbe && (
                  <div>
                    <p className="text-gray-600 text-xs">Farbe</p>
                    <p className="font-medium">{(fahrzeug as any).farbe}</p>
                  </div>
                )}
                {(fahrzeug as any)?.motortyp && (
                  <div>
                    <p className="text-gray-600 text-xs">Kraftstoff</p>
                    <p className="font-medium">{(fahrzeug as any).motortyp}</p>
                  </div>
                )}
                {(fahrzeug as any)?.leistung_kw && (
                  <div>
                    <p className="text-gray-600 text-xs">Leistung</p>
                    <p className="font-medium">{(fahrzeug as any).leistung_kw} kW ({Math.round((fahrzeug as any).leistung_kw * 1.35962)} PS)</p>
                  </div>
                )}
                {(fahrzeug as any)?.hubraum && (
                  <div>
                    <p className="text-gray-600 text-xs">Hubraum</p>
                    <p className="font-medium">{parseInt((fahrzeug as any).hubraum).toLocaleString('de-DE')} ccm</p>
                  </div>
                )}
                {fahrzeug?.fahrgestellnummer && (
                  <div className="col-span-2">
                    <p className="text-gray-600 text-xs">Fahrgestellnummer</p>
                    <p className="font-mono text-xs">{fahrzeug.fahrgestellnummer}</p>
                  </div>
                )}
                {(fahrzeug as any)?.notizen && (fahrzeug as any).fahrzeug_typ === 'eigen' && (
                  <div className="col-span-2 bg-purple-50 rounded-lg px-3 py-2">
                    <p className="text-purple-700 text-sm font-medium">{(fahrzeug as any).notizen}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Customer Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-5 h-5 text-blue-500" />
                Kunde
                {!kunde && (
                  <Button size="sm" variant="outline" className="ml-auto text-xs h-7 px-2" onClick={() => { setShowKundeModal(true); ladeKunden('') }}>
                    + Zuweisen
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {kunde ? (
                <>
                  <p className="font-medium text-gray-900">{(kunde as any).vorname} {(kunde as any).nachname}</p>
                  {(kunde as any).firma && <p className="text-gray-800">{(kunde as any).firma}</p>}
                  {(kunde as any).telefon && <p className="text-gray-800">📞 {(kunde as any).telefon}</p>}
                  {(kunde as any).mobil && <p className="text-gray-800">📱 {(kunde as any).mobil}</p>}
                  {(kunde as any).ort && <p className="text-gray-800">📍 {(kunde as any).ort}</p>}
                  <button className="text-xs text-blue-500 underline mt-1" onClick={() => { setShowKundeModal(true); ladeKunden('') }}>Kunden ändern</button>
                </>
              ) : (
                <p className="text-gray-400 italic">Kein Kunde zugewiesen</p>
              )}
            </CardContent>
          </Card>

          {/* Kunden zuweisen Modal */}
          {showKundeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowKundeModal(false)}>
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Kunden zuweisen</h2>
                  <button onClick={() => setShowKundeModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <input
                  autoFocus
                  className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
                  placeholder="Name oder Firma suchen…"
                  value={kundeSearch}
                  onChange={e => { setKundeSearch(e.target.value); ladeKunden(e.target.value) }}
                />
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {kundenListe.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Keine Kunden gefunden</p>
                  )}
                  {kundenListe.map(k => (
                    <button
                      key={k.id}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                      disabled={kundeZuweisenLoading}
                      onClick={() => handleKundeZuweisen(k.id)}
                    >
                      <p className="font-medium text-sm">{k.vorname} {k.nachname}</p>
                      {k.firma && <p className="text-xs text-gray-500">{k.firma}</p>}
                      {(k.telefon || k.mobil) && <p className="text-xs text-gray-400">{k.mobil || k.telefon}</p>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fertig, aber keine Möglichkeit den Kunden zu erreichen -> deutlich sagen, statt die Karte still wegzulassen */}
          {auftrag.status === 'fertig' && !isEigenfahrzeug && (!kunde || !(kunde.mobil || kunde.telefon || kunde.email)) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Kunde kann nicht benachrichtigt werden</p>
              <p className="mt-0.5">
                {kunde
                  ? `Für ${`${kunde.vorname ?? ''} ${kunde.nachname ?? ''}`.trim() || 'den Kunden'} ist weder Handynummer noch Telefon noch E-Mail hinterlegt — bitte im Kundenprofil ergänzen.`
                  : 'Diesem Auftrag ist noch kein Kunde zugewiesen — bitte oben einen Kunden zuweisen.'}
              </p>
            </div>
          )}

          {/* Kunden-Benachrichtigung wenn fertig */}
          {auftrag.status === 'fertig' && kunde && (kunde.mobil || kunde.telefon || kunde.email) && (() => {
            const name = `${fahrzeug?.marke ?? ''} ${fahrzeug?.modell ?? ''}`.trim()
            const kz = fahrzeug?.kennzeichen ?? ''
            const kundenName = `${kunde.vorname} ${kunde.nachname}`.trim()
            const smsText = `Hallo ${kunde.vorname}, Ihr Fahrzeug ${name}${kz ? ` (${kz})` : ''} ist fertig und kann abgeholt werden. Herzliche Grüße, Ihre Kfz-Werkstatt`
            const tel = kunde.mobil || kunde.telefon || ''
            const telClean = waNummer(kunde.mobil) || waNummer(kunde.telefon)   // nur Ziffern, internationale Form
            return (
              <Card className="border-green-300 bg-green-50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-green-800">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                    Kunden benachrichtigen
                  </CardTitle>
                  <p className="text-xs text-green-700">Fahrzeug ist fertig — {kundenName} informieren</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <textarea
                    readOnly
                    value={smsText}
                    rows={3}
                    className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm bg-white text-gray-800 resize-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    {tel && (
                      <a
                        href={`sms:${tel}?body=${encodeURIComponent(smsText)}`}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Phone className="w-4 h-4" /> SMS senden
                      </a>
                    )}
                    {telClean && (
                      <a
                        href={`https://wa.me/${telClean}?text=${encodeURIComponent(smsText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#1ebe5a] text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" /> WhatsApp
                      </a>
                    )}
                    {kunde.email && (
                      <button
                        onClick={async () => {
                          setFertigEmailStatus('senden')
                          try {
                            const res = await fetch('/api/rechnung-email', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ auftrag_id: auftrag.id, typ: 'fertig' }),
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(data.error ?? 'Fehler')
                            setFertigEmailStatus('ok')
                          } catch {
                            setFertigEmailStatus('fehler')
                          }
                        }}
                        disabled={fertigEmailStatus === 'senden' || fertigEmailStatus === 'ok'}
                        className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 hover:bg-green-100 text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                      >
                        <Mail className="w-4 h-4" />
                        {fertigEmailStatus === 'senden' ? 'Wird gesendet…' : fertigEmailStatus === 'ok' ? '✓ E-Mail gesendet' : fertigEmailStatus === 'fehler' ? '⚠ Fehler' : 'E-Mail senden'}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-green-800/70">SMS und WhatsApp öffnen sich auf diesem Gerät — Absender ist die Nummer dieses Geräts bzw. des dort angemeldeten WhatsApp-Kontos (für die Firmennummer: WhatsApp Business verwenden). Die E-Mail geht von der Firmen-Absenderadresse aus den Einstellungen.</p>
                </CardContent>
              </Card>
            )
          })()}

          {/* Work Description */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="w-5 h-5 text-gray-800" />
                Durchzuführende Arbeiten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={arbeiten}
                onChange={e => setArbeiten(e.target.value)}
                placeholder="Beschreibung der Arbeiten..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div>
                <label className="text-xs text-gray-800 mb-1.5 block">Geschätzte Dauer</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '½ Tag', value: '0.5' },
                    { label: '1 Tag', value: '1' },
                    { label: '2 Tage', value: '2' },
                    { label: '3 Tage', value: '3' },
                    { label: '1 Woche', value: '5' },
                    { label: '2 Wochen', value: '10' },
                  ].map(opt => {
                    const active = dauerTage === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => dauerWaehlen(opt.value)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                          active
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:text-orange-600'
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={dauerTage}
                    onChange={e => dauerWaehlen(e.target.value)}
                    placeholder="… eigene"
                    className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-800 mb-1 block">Geplante Fertigstellung</label>
                  <input
                    type="date"
                    value={fertigDatum}
                    onChange={e => setFertigDatum(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400',
                      overdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    )}
                  />
                </div>
                <Button
                  onClick={saveArbeiten}
                  disabled={saving}
                  className="bg-orange-600 hover:bg-orange-700 text-white mt-5"
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Parts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="w-5 h-5 text-yellow-500" />
                Ersatzteile ({teile.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAddTeil(v => !v)}
                  className="gap-1"
                >
                  <Plus className="w-4 h-4" /> Teil hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Add form */}
              {showAddTeil && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-200">
                  {/* Suchfeld mit Autocomplete */}
                  <div ref={suchRef} className="relative col-span-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      <input
                        placeholder="Teil suchen oder neu eingeben…"
                        value={suchbegriff}
                        onChange={e => {
                          setSuchbegriff(e.target.value)
                          setNewTeil(p => ({ ...p, bezeichnung: e.target.value }))
                          setShowVorschlaege(true)
                        }}
                        onFocus={() => setShowVorschlaege(true)}
                        className="w-full pl-8 pr-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                      />
                    </div>
                    {showVorschlaege && gefilterteVorschlaege.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                        {gefilterteVorschlaege.map((v) => (
                          <button
                            key={`${v.bezeichnung}-${v.teilenummer}-${v.lieferant}`}
                            type="button"
                            onMouseDown={() => vorschlagWaehlen(v)}
                            className="w-full text-left px-3 py-2.5 hover:bg-orange-50 border-b border-gray-50 last:border-0 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{v.bezeichnung}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {v.teilenummer && <span className="font-mono">{v.teilenummer}</span>}
                                  {v.teilenummer && v.lieferant && <span> · </span>}
                                  {v.lieferant && <span>{v.lieferant}</span>}
                                </p>
                              </div>
                              {v.einzelpreis != null && (
                                <span className="text-sm font-semibold text-orange-700 flex-shrink-0">
                                  {v.einzelpreis.toFixed(2)} €
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                        {!suchbegriff.trim() && teilVorschlaege.length > 8 && (
                          <p className="text-xs text-gray-400 px-3 py-2 text-center">
                            {teilVorschlaege.length - 8} weitere — tippen zum Filtern
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Teilenummer"
                      value={newTeil.teilenummer}
                      onChange={e => setNewTeil(p => ({ ...p, teilenummer: e.target.value }))}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <input
                      placeholder="Lieferant"
                      value={newTeil.lieferant}
                      onChange={e => setNewTeil(p => ({ ...p, lieferant: e.target.value }))}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <input
                      type="number"
                      placeholder="Menge"
                      value={newTeil.menge}
                      min={1}
                      onChange={e => setNewTeil(p => ({ ...p, menge: parseInt(e.target.value) || 1 }))}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Einzelpreis (€)"
                      value={newTeil.einzelpreis}
                      onChange={e => setNewTeil(p => ({ ...p, einzelpreis: e.target.value }))}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {/* PV Kompass Link - öffnet neue Tab */}
                    {newTeil.bezeichnung.trim() && (
                      <button
                        onClick={() => {
                          const link = generatePvKompassLink({
                            bezeichnung: newTeil.bezeichnung,
                            teilenummer: newTeil.teilenummer,
                            fahrzeug: { marke: (auftrag.fahrzeug as any)?.marke, modell: (auftrag.fahrzeug as any)?.modell, fahrzeugtyp: (auftrag.fahrzeug as any)?.fahrzeugtyp }
                          })
                          console.log('PV Kompass Link:', link)
                          window.open(link, '_blank', 'noopener,noreferrer')
                        }}
                        className="flex-1 min-w-[60px] bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm font-medium text-center transition-colors cursor-pointer"
                      >
                        PV
                      </button>
                    )}
                    {/* PartsFinder Link - öffnet neue Tab (kein Deep-Link/Login-Autofill möglich, da login-pflichtig) */}
                    <button
                      onClick={() => window.open('https://www.partsfinder.de/login', '_blank', 'noopener,noreferrer')}
                      className="flex-1 min-w-[100px] bg-slate-600 hover:bg-slate-700 text-white py-2 px-3 rounded-lg text-sm font-medium text-center transition-colors cursor-pointer"
                    >
                      PartsFinder
                    </button>
                    {/* Lokal als bestellt - speichert mit status='bestellt' */}
                    <button
                      onClick={handleAddTeilUndBestellen}
                      disabled={!newTeil.bezeichnung.trim()}
                      className="flex-1 min-w-[140px] bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                    >
                      ✅ Lokal bestellt
                    </button>
                    {/* Abbrechen */}
                    <button
                      onClick={() => { setShowAddTeil(false); setSuchbegriff(''); setNewTeil({ bezeichnung: '', teilenummer: '', lieferant: '', menge: 1, einzelpreis: '' }) }}
                      className="flex-1 min-w-[100px] bg-gray-300 hover:bg-gray-400 text-gray-900 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                    >
                      ✕ Abbrechen
                    </button>
                  </div>
                </div>
              )}

              {/* Parts list */}
              {teile.length === 0 && !showAddTeil ? (
                <div className="text-center py-8 text-gray-600">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Keine Teile erfasst</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {teile.map(teil => (
                    <div key={teil.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{teil.bezeichnung}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {teil.teilenummer && (
                            <span className="text-xs text-gray-600 font-mono">{teil.teilenummer}</span>
                          )}
                          {teil.lieferant && (
                            <span className="text-xs text-gray-600">• {teil.lieferant}</span>
                          )}
                          <span className="text-xs text-gray-600">• {teil.menge}x</span>
                          {teil.einzelpreis && (
                            <span className="text-xs text-gray-600">• {(teil.einzelpreis * teil.menge).toFixed(2)} €</span>
                          )}
                        </div>
                      </div>
                      <select
                        value={teil.status}
                        onChange={e => handleTeilStatusChange(teil.id, e.target.value as TeilStatus)}
                        className={cn(
                          'text-xs px-2.5 py-1.5 rounded-full border font-medium focus:outline-none cursor-pointer',
                          TEIL_STATUS_COLOR[teil.status as TeilStatus]
                        )}
                      >
                        {TEIL_STATUS_ORDER.map(s => (
                          <option key={s} value={s}>{TEIL_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleDeleteTeil(teil.id)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:w-72 space-y-4">
          {/* Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Arbeitsstatus</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">Status anklicken zum Ändern</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {(isEigenfahrzeug ? STATUS_ORDER_EIGEN : STATUS_ORDER_FREMD).map(s => {
                // Skip "Verkaufen" button if we have a special modal for it
                if (s === 'verkauft' && isEigenfahrzeug && auftrag.status === 'fertig') {
                  return null
                }
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all cursor-pointer',
                      auftrag.status === s
                        ? cn(FAHRZEUG_STATUS_COLOR[s], 'border-current shadow-sm ring-2 ring-offset-1 ring-current/30')
                        : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-white hover:border-gray-400 hover:text-gray-900 hover:shadow-sm'
                    )}
                  >
                    {auftrag.status === s ? (
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 flex-shrink-0 opacity-30" />
                    )}
                    <span className="flex-1 text-left">{FAHRZEUG_STATUS_LABEL[s]}</span>
                    {auftrag.status !== s && <ChevronRight className="w-3.5 h-3.5 opacity-30" />}
                  </button>
                )
              })}

              {/* Verkaufen-Button für Eigenfahrzeuge */}
              {isEigenfahrzeug && auftrag.status === 'fertig' && (
                <button
                  onClick={() => setShowVerkaufenModal(true)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg border border-green-200 text-sm font-medium transition-all cursor-pointer bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400"
                >
                  <Car className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">🚗 Als verkauft markieren</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>
              )}

              {buehneWarnung && (
                <div id="buehne-warnung" className="mt-2 bg-yellow-50 border border-yellow-300 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xl leading-none">⚠️</span>
                    <div>
                      <p className="text-sm font-semibold text-yellow-800">Kein Stellplatz zugewiesen</p>
                      <p className="text-xs text-yellow-700 mt-0.5">Auf welcher Bühne steht das Fahrzeug?</p>
                    </div>
                  </div>
                  <select
                    value={buehneWahl}
                    onChange={e => setBuehneWahl(e.target.value)}
                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  >
                    <option value="">— Bühne auswählen —</option>
                    {hebebuehnen.map(h => (
                      <option key={h.id} value={h.id}>{h.bezeichnung}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBuehneUndStatus(buehneWahl)}
                      disabled={!buehneWahl}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      Zuweisen & Status setzen
                    </button>
                    <button
                      onClick={() => setBuehneWarnung(null)}
                      className="px-3 py-2 text-sm text-yellow-700 hover:text-yellow-900"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bay Assignment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hebebühne</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={auftrag.hebebuehne_id ?? ''}
                onChange={e => handleBuehneChange(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">— Keine Bühne —</option>
                {hebebuehnen.map(h => (
                  <option key={h.id} value={h.id}>{h.bezeichnung}</option>
                ))}
              </select>
              {auftrag.hebebuehne && (
                <p className="text-xs text-gray-800 mt-2">
                  Zugewiesen: <span className="font-medium">{auftrag.hebebuehne.bezeichnung}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Mitarbeiter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="w-5 h-5 text-indigo-500" />
                Zuständig
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mitarbeiter.length === 0 ? (
                <p className="text-xs text-gray-500">Keine Mitarbeiter angelegt</p>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => handleMitarbeiterChange('')}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-all',
                      !zugewiesenAn
                        ? 'bg-gray-100 border-gray-300 font-medium text-gray-700'
                        : 'bg-gray-50 border-gray-100 text-gray-400 hover:bg-white hover:border-gray-300'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <span>Niemand</span>
                  </button>
                  {mitarbeiter.map(m => {
                    const initials = m.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                    const firstName = m.full_name.split(' ')[0]
                    const roleLabel = m.role === 'werkstattmeister' ? 'Meister' : m.role === 'mechaniker' ? 'Mechaniker' : 'Admin'
                    const isSelected = zugewiesenAn === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => handleMitarbeiterChange(m.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-all',
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-sm ring-1 ring-indigo-200'
                            : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-white hover:border-gray-300 hover:text-gray-900'
                        )}
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                        )}>
                          {initials}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm leading-tight">{firstName}</p>
                          <p className="text-xs opacity-60">{roleLabel}</p>
                        </div>
                        {isSelected && <CheckCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* TÜV */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                TÜV
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">Termin buchen &amp; Prüfergebnis festhalten</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tuevKandidat}
                  onChange={e => setTuevKandidat(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600"
                />
                <span className="text-sm font-medium text-gray-700">TÜV-Kandidat</span>
              </label>
              <div>
                <label className="text-xs text-gray-800 mb-1 block">TÜV-Termin</label>
                <input
                  type="date"
                  value={tuevTermin}
                  onChange={e => setTuevTermin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-800 mb-1 block">TÜV-Ergebnis</label>
                <select
                  value={tuevErgebnis}
                  onChange={e => setTuevErgebnis(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">— Ausstehend —</option>
                  <option value="bestanden">✅ Bestanden</option>
                  <option value="maengel">⚠️ Mängel</option>
                  <option value="nicht_bestanden">❌ Nicht bestanden</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-800 mb-1 block">Nächste HU (TÜV-Wecker)</label>
                <input
                  type="date"
                  value={naechsteHu}
                  onChange={e => setNaechsteHu(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <p className="text-[11px] text-gray-400 mt-1">Wird im TÜV-Wecker angezeigt</p>
              </div>
              <Button onClick={saveTuev} size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white">
                TÜV speichern
              </Button>
            </CardContent>
          </Card>

          {/* Service */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="w-5 h-5 text-blue-600" />
                Service
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">Nächster Service-Termin für Service-Wecker</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-gray-800 mb-1 block">Nächster Service-Termin</label>
                <input
                  type="date"
                  value={naechsterService}
                  onChange={e => setNaechsterService(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-[11px] text-gray-400 mt-1">Wird im Service-Wecker angezeigt</p>
              </div>
              <Button
                onClick={saveServiceDaten}
                disabled={savingService}
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {savingService ? 'Wird gespeichert…' : 'Service speichern'}
              </Button>
            </CardContent>
          </Card>

          {/* History */}
          {historie.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Statusverlauf</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {historie.map((h: any) => (
                  <div key={h.id} className="text-xs text-gray-800">
                    <div className="flex items-center gap-1">
                      {h.status_alt && (
                        <>
                          <span className={cn(
                            'inline-flex px-1.5 py-0.5 rounded text-xs border',
                            FAHRZEUG_STATUS_COLOR[h.status_alt as FahrzeugStatus]
                          )}>
                            {FAHRZEUG_STATUS_LABEL[h.status_alt as FahrzeugStatus] ?? h.status_alt}
                          </span>
                          <span>→</span>
                        </>
                      )}
                      <span className={cn(
                        'inline-flex px-1.5 py-0.5 rounded text-xs border',
                        FAHRZEUG_STATUS_COLOR[h.status_neu as FahrzeugStatus]
                      )}>
                        {FAHRZEUG_STATUS_LABEL[h.status_neu as FahrzeugStatus] ?? h.status_neu}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-0.5">{formatDateTime(h.erstellt_am)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Gefahrenzone */}
      <div className="border border-red-200 rounded-xl p-4 bg-red-50">
        <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Gefahrenzone</p>
        <p className="text-xs text-red-400 mb-3">
          <strong>Stornieren</strong> markiert den Auftrag als abgebrochen — er bleibt sichtbar und ist rückgängig machbar. &nbsp;
          <strong>Löschen</strong> entfernt den Auftrag dauerhaft aus der Datenbank.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          {auftrag.status !== 'storniert' && (
            <button
              onClick={() => setStorniereBestaetigung(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-300 bg-white text-red-600 hover:bg-red-100 text-sm font-medium transition-colors"
            >
              <Ban className="w-4 h-4" /> Auftrag stornieren
            </button>
          )}
          {['verkauft', 'ausgeliefert'].includes(auftrag.status) ? (
            <p className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
              <FolderOpen className="w-4 h-4 flex-shrink-0 text-orange-500" />
              Verkaufte bzw. übergebene Fahrzeuge werden samt Auftragsmappe dauerhaft aufbewahrt und können nicht gelöscht werden.
            </p>
          ) : (
            <button
              onClick={() => setLoeschenBestaetigung(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-400 bg-red-600 text-white hover:bg-red-700 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Auftrag endgültig löschen
            </button>
          )}
        </div>
      </div>

      {/* Kostenvoranschlag, Werkstattauftrag, Rechnungen */}
      <div key={dokumenteBlockKey} id="vorgang-dokumente" className="space-y-6 mt-6 scroll-mt-20">
        {betriebId && (
          <>
            <KostenvoranschlagSection auftragId={auftrag.id} betriebId={betriebId} fahrzeugId={(auftrag.fahrzeug as any)?.id} refreshSignal={kvRefreshSignal} />
            <WerkstattauftragSection auftragId={auftrag.id} betriebId={betriebId} fahrzeugId={(auftrag.fahrzeug as any)?.id} />
            <RechnungSection auftragId={auftrag.id} betriebId={betriebId} fahrzeugId={(auftrag.fahrzeug as any)?.id} />
          </>
        )}
      </div>

      {/* Dokumente & Dateien (CarVertical, Gutachten, ...) */}
      <Card className="border-slate-200 mt-6">
        <CardContent className="p-6">
          <AuftragDokumente auftragId={auftrag.id} />
        </CardContent>
      </Card>

      {/* Lieferschein / Rechnung Scanner */}
      {betriebId && (
        <Card className="border-slate-200 mt-6">
          <CardContent className="p-6">
            <LieferscheinGalerie auftragId={auftrag.id} refreshSignal={dokumenteRefresh} />
            <LieferscheinQuickScan
              auftragId={auftrag.id}
              betriebId={betriebId}
              onSuccess={() => {
                console.log('✅ Dokument gescannt und archiviert')
                setDokumenteRefresh(r => r + 1)
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Lieferanten-Rechnungen */}
      <Card className="border-slate-200 mt-6">
        <CardContent className="p-6">
          <SupplierInvoices
            fahrzeugId={(auftrag.fahrzeug as any)?.id ?? ''}
            fahrzeugName={`${(auftrag.fahrzeug as any)?.marke ?? ''} ${(auftrag.fahrzeug as any)?.modell ?? ''}`}
          />
        </CardContent>
      </Card>

      {/* Verkaufen Modal */}
      {showVerkaufenModal && (
        <VerkaufenModal
          auftragId={auftrag.id}
          fahrzeugId={(auftrag.fahrzeug as any)?.id ?? null}
          marke={(auftrag.fahrzeug as any)?.marke ?? ''}
          modell={(auftrag.fahrzeug as any)?.modell ?? ''}
          einkaufspreis={(auftrag.fahrzeug as any)?.einkaufspreis ?? null}
          standardSteuerart={detailSteuerart}
          onClose={() => setShowVerkaufenModal(false)}
          onSuccess={() => {
            setShowVerkaufenModal(false)
            // Seite nach 500ms neuladen, damit Status aktualisiert ist
            setTimeout(() => window.location.reload(), 500)
          }}
        />
      )}
    </div>
  )
}
