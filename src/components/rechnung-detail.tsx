'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  werkstattauftragId: string
  kostenvoranschlagId: string
  betriebId: string
  fahrzeugId: string
}

export function RechnungDetail({
  werkstattauftragId,
  kostenvoranschlagId,
  betriebId,
  fahrzeugId,
}: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [werkstattauftragId, kostenvoranschlagId, fahrzeugId])

  const loadData = async () => {
    try {
      const supabase = await createClient()

      // Lade Werkstattauftrag mit Positionen
      const { data: wa } = await supabase
        .from('werkstattauftraege')
        .select('*, positionen:werkstattauftrag_positionen(*)')
        .eq('id', werkstattauftragId)
        .single()

      // Lade Kostenvoranschlag mit Positionen
      const { data: kv } = await supabase
        .from('kostenvoranschlaege')
        .select('*, positionen:kostenvoranschlag_positionen(*)')
        .eq('id', kostenvoranschlagId)
        .single()

      // Lade Fahrzeug
      const { data: fahrzeug } = await supabase
        .from('fahrzeuge')
        .select('*')
        .eq('id', fahrzeugId)
        .single()

      // Lade Betrieb
      const { data: betrieb } = await supabase
        .from('betriebe')
        .select('*')
        .eq('id', betriebId)
        .single()

      setData({
        werkstattauftrag: wa,
        kostenvoranschlag: kv,
        fahrzeug,
        betrieb,
      })
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return <div className="text-center py-8 text-slate-500">Wird geladen...</div>
  }

  const arbeitszeiten = data.werkstattauftrag?.positionen || []
  const ersatzteile_modus = data.kostenvoranschlag?.ersatzteile_modus || 'festpreis'
  const ersatzteile_festpreis = data.kostenvoranschlag?.ersatzteile_festpreis || 0
  const arbeitszeiten_summe = arbeitszeiten.reduce((sum: number, pos: any) => sum + (pos.summe || 0), 0)
  const ersatzteile_summe = modus === 'einzeln'
    ? ersatzteile_positionen.reduce((sum: number, pos: any) => sum + (pos.preis || 0), 0)
    : ersatzteile_festpreis
  const netto = arbeitszeiten_summe + ersatzteile_summe
  const mwst = netto * 0.19
  const brutto = netto + mwst
  const modus = ersatzteile_modus
  const ersatzteile_positionen = data.kostenvoranschlag?.positionen || []

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white">
      {/* Header */}
      <div className="mb-8 pb-4 border-b-2">
        <h1 className="text-2xl font-bold text-slate-800">{data.betrieb?.name}</h1>
        <p className="text-sm text-slate-600">
          {data.betrieb?.strasse} | {data.betrieb?.plz} {data.betrieb?.ort}
        </p>
        <p className="text-sm text-slate-600">
          📞 {data.betrieb?.telefon} | 📧 {data.betrieb?.email}
        </p>
      </div>

      {/* Fahrzeug & Kunde */}
      <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
        <div>
          <p className="font-medium text-slate-700">FAHRZEUG</p>
          <p>{data.fahrzeug?.marke} {data.fahrzeug?.modell}</p>
          <p className="text-slate-600">FIN: {data.fahrzeug?.fin}</p>
          <p className="text-slate-600">Kennzeichen: {data.fahrzeug?.kennzeichen}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg">RECHNUNG</p>
          <p className="text-slate-600">Datum: {new Date().toLocaleDateString('de-DE')}</p>
        </div>
      </div>

      {/* Tabelle */}
      <table className="w-full mb-8 text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-300">
            <th className="text-left py-3 px-2">Position</th>
            <th className="text-right py-3 px-2 w-20">Menge</th>
            <th className="text-right py-3 px-2 w-24">€/Einh</th>
            <th className="text-right py-3 px-2 w-24">Summe €</th>
          </tr>
        </thead>
        <tbody>
          {/* Arbeitszeiten */}
          {arbeitszeiten.length > 0 && (
            <>
              <tr className="bg-blue-50">
                <td colSpan={4} className="py-2 px-2 font-medium">
                  🔧 Arbeitszeiten
                </td>
              </tr>
              {arbeitszeiten.map((pos) => (
                <tr key={pos.id} className="border-b border-slate-200">
                  <td className="py-2 px-2">{pos.beschreibung}</td>
                  <td className="text-right py-2 px-2">{pos.menge} h</td>
                  <td className="text-right py-2 px-2">{pos.preis.toFixed(2)} €</td>
                  <td className="text-right py-2 px-2 font-medium">{(pos.summe || 0).toFixed(2)} €</td>
                </tr>
              ))}
            </>
          )}

          {/* Ersatzteile - FESTPREIS MODUS */}
          {modus === 'festpreis' && ersatzteile_summe > 0 && (
            <tr className="border-b border-slate-200 bg-green-50">
              <td className="py-2 px-2 font-medium">⚙️ Ersatzteile (Festpreis)</td>
              <td className="text-right py-2 px-2"></td>
              <td className="text-right py-2 px-2"></td>
              <td className="text-right py-2 px-2 font-medium">{ersatzteile_summe.toFixed(2)} €</td>
            </tr>
          )}

          {/* Ersatzteile - EINZELN MODUS */}
          {modus === 'einzeln' && ersatzteile_positionen.length > 0 && (
            <>
              <tr className="bg-green-50">
                <td colSpan={4} className="py-2 px-2 font-medium">
                  ⚙️ Ersatzteile
                </td>
              </tr>
              {ersatzteile_positionen.map((pos: any) => (
                <tr key={pos.id} className="border-b border-slate-200">
                  <td className="py-2 px-2">- {pos.beschreibung}</td>
                  <td className="text-right py-2 px-2">1</td>
                  <td className="text-right py-2 px-2">{pos.preis?.toFixed(2) || '0.00'} €</td>
                  <td className="text-right py-2 px-2 font-medium">{pos.preis?.toFixed(2) || '0.00'} €</td>
                </tr>
              ))}
              <tr className="font-bold bg-green-100">
                <td className="py-2 px-2">Summe Ersatzteile:</td>
                <td className="text-right py-2 px-2"></td>
                <td className="text-right py-2 px-2"></td>
                <td className="text-right py-2 px-2">{ersatzteile_summe.toFixed(2)} €</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* Summen */}
      <div className="ml-auto w-80 space-y-1 text-sm border-t-2 border-slate-300 pt-4">
        <div className="flex justify-between py-2">
          <span>Netto:</span>
          <span className="font-medium">{netto.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between py-2 border-b border-slate-300">
          <span>MwSt (19%):</span>
          <span className="font-medium">{mwst.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between py-3 text-lg font-bold text-blue-600">
          <span>GESAMT:</span>
          <span>{brutto.toFixed(2)} €</span>
        </div>
      </div>

      {/* Footer & Print Button */}
      <div className="mt-12 pt-8 border-t text-xs text-slate-500 space-y-2">
        <p>Vielen Dank für Ihren Auftrag! ✓</p>
        <p>USt-ID: {data.betrieb?.ust_id || '-'}</p>
      </div>

      {/* Print Button */}
      <div className="mt-8 flex gap-2 no-print">
        <Button
          onClick={handlePrint}
          className="bg-slate-600 hover:bg-slate-700 flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Drucken / PDF
        </Button>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  )
}
