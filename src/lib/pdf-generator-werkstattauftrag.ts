import { generatePDF } from '@/lib/pdf-generator'

export interface WerkstattauftragPDF {
  nummer: string
  datum: string
  auftragId: string

  // Fahrzeug
  fahrzeug: {
    marke: string
    modell: string
    fin: string
    kennzeichen?: string
    baujahr?: string
    farbe?: string
    kilometerstand?: number
    motortyp?: string
    hubraum?: string
    leistungKw?: number
    naechsteHu?: string
  }

  // Kunde
  kundenName: string
  kundenStrasse: string
  kundenPlz: string
  kundenOrt: string
  kundenTelefon?: string

  // Arbeiten & Teile (bewusst ohne Preise — interner Arbeitsauftrag für den Mechaniker)
  arbeiten?: string
  bemerkungen?: string
  teile: Array<{ beschreibung: string; menge: number }>

  // Firma
  firmaDaten: {
    name: string
    strasse: string
    plz: string
    ort: string
    telefon?: string
    email?: string
    logo?: string
  }

  status: string
}

const statusLabels: Record<string, string> = {
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  fertig: 'Fertig',
  abgeschlossen: 'Abgeschlossen',
}

function fmtKw(kw?: number): string {
  if (!kw) return '-'
  const ps = Math.round(kw * 1.35962)
  return `${kw} kW (${ps} PS)`
}

export async function generateWerkstattauftragPDF(daten: WerkstattauftragPDF): Promise<Buffer> {
  const teileRowsHtml = daten.teile.length > 0
    ? daten.teile
        .map(
          teil => `
            <tr>
              <td>${escapeHtml(teil.beschreibung)}</td>
              <td style="text-align:center;">${teil.menge}</td>
            </tr>`
        )
        .join('')
    : `<tr><td colspan="2" style="text-align:center; color:#888;">Keine Teile erfasst</td></tr>`

  const arbeitenHtml = daten.arbeiten
    ? escapeHtml(daten.arbeiten).replace(/\n/g, '<br/>')
    : '<span style="color:#888;">Keine Arbeitsbeschreibung hinterlegt</span>'

  const ortZeile = [daten.firmaDaten.plz, daten.firmaDaten.ort].filter(Boolean).join(' ')
  const betriebAdresse = [daten.firmaDaten.strasse, ortZeile].filter(Boolean).join(', ')

  const data = {
    logoBase64: daten.firmaDaten.logo || '',
    betriebName: daten.firmaDaten.name,
    betriebAdresse,
    betriebTel: daten.firmaDaten.telefon ? `Tel: ${daten.firmaDaten.telefon}` : '',

    auftragNummer: daten.nummer,
    datum: daten.datum,
    status: statusLabels[daten.status] || daten.status,

    fahrzeugMarke: daten.fahrzeug.marke,
    fahrzeugModell: daten.fahrzeug.modell,
    fahrzeugKennzeichen: daten.fahrzeug.kennzeichen || '-',
    fahrzeugFin: daten.fahrzeug.fin || '-',
    fahrzeugBaujahr: daten.fahrzeug.baujahr || '-',
    fahrzeugFarbe: daten.fahrzeug.farbe || '-',
    fahrzeugKm: daten.fahrzeug.kilometerstand ? `${daten.fahrzeug.kilometerstand.toLocaleString('de-DE')} km` : '-',
    fahrzeugMotor: daten.fahrzeug.motortyp || '-',
    fahrzeugHubraum: daten.fahrzeug.hubraum || '-',
    fahrzeugLeistung: fmtKw(daten.fahrzeug.leistungKw),
    fahrzeugHu: daten.fahrzeug.naechsteHu || '-',

    kundeName: daten.kundenName,
    kundeAdresse: daten.kundenStrasse,
    kundeOrt: `${daten.kundenPlz} ${daten.kundenOrt}`,
    kundeTel: daten.kundenTelefon || '-',

    arbeitenHtml,
    teileRowsHtml,
    bemerkungen: daten.bemerkungen || '',
  }

  return generatePDF('werkstattauftrag', data)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
