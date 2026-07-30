import PDFDocument from 'pdfkit'

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
  }

  // Kunde
  kundenName: string
  kundenStrasse: string
  kundenPlz: string
  kundenOrt: string
  kundenTelefon?: string

  // Arbeiten & Teile
  arbeiten?: string
  bemerkungen?: string
  ersatzteile: Array<{
    teilenummer?: string
    beschreibung: string
    menge: number
    einzelpreis: number
    status: string
  }>

  // Firma
  firmaDaten: {
    name: string
    strasse: string
    plz: string
    ort: string
    telefon?: string
    email?: string
    ustId?: string
  }

  status: string
  faelligkeitsDatum?: string
}

export async function generateWerkstattauftragPDF(daten: WerkstattauftragPDF): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
    })

    const chunks: Buffer[] = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text(daten.firmaDaten.name, { align: 'left' })
    doc.fontSize(10).font('Helvetica')
      .text(`${daten.firmaDaten.strasse}, ${daten.firmaDaten.plz} ${daten.firmaDaten.ort}`)
    if (daten.firmaDaten.telefon) doc.text(`Tel: ${daten.firmaDaten.telefon}`)
    if (daten.firmaDaten.email) doc.text(`Email: ${daten.firmaDaten.email}`)

    doc.moveTo(40, 120).lineTo(555, 120).stroke()

    // Titel
    doc.fontSize(18).font('Helvetica-Bold').text('WERKSTATTAUFTRAG', { align: 'center' })

    // Auftragsinfo
    doc.fontSize(10).font('Helvetica')
    doc.text(`Auftragsummer: ${daten.nummer}`, 50, 150)
    doc.text(`Datum: ${daten.datum}`, 50, 165)
    doc.text(`Status: ${daten.status}`, 50, 180)
    if (daten.faelligkeitsDatum) doc.text(`Fällig bis: ${daten.faelligkeitsDatum}`, 50, 195)

    // Kundeninfo
    doc.fontSize(11).font('Helvetica-Bold').text('Kundeninfo:', 50, 220)
    doc.fontSize(10).font('Helvetica')
    doc.text(daten.kundenName, 50, 240)
    doc.text(`${daten.kundenStrasse}`, 50, 255)
    doc.text(`${daten.kundenPlz} ${daten.kundenOrt}`, 50, 270)
    if (daten.kundenTelefon) doc.text(`Tel: ${daten.kundenTelefon}`, 50, 285)

    // Fahrzeuginfo
    doc.fontSize(11).font('Helvetica-Bold').text('Fahrzeuginfo:', 350, 220)
    doc.fontSize(10).font('Helvetica')
    doc.text(`${daten.fahrzeug.marke} ${daten.fahrzeug.modell}`, 350, 240)
    doc.text(`Kennzeichen: ${daten.fahrzeug.kennzeichen || '-'}`, 350, 255)
    doc.text(`FIN: ${daten.fahrzeug.fin}`, 350, 270)
    if (daten.fahrzeug.baujahr) doc.text(`Baujahr: ${daten.fahrzeug.baujahr}`, 350, 285)
    if (daten.fahrzeug.kilometerstand) doc.text(`KM: ${daten.fahrzeug.kilometerstand.toLocaleString('de-DE')}`, 350, 300)

    let yPos = 320

    // Arbeiten
    if (daten.arbeiten) {
      doc.fontSize(11).font('Helvetica-Bold').text('Zu durchführende Arbeiten:', 50, yPos)
      yPos += 20
      doc.fontSize(10).font('Helvetica')
        .text(daten.arbeiten, 50, yPos, { width: 505, align: 'left' })
      yPos += 60
    }

    // Ersatzteile
    if (daten.ersatzteile && daten.ersatzteile.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').text('Benötigte Ersatzteile:', 50, yPos)
      yPos += 20

      // Tabellen-Header
      const colX = [50, 120, 300, 420, 480]
      doc.fontSize(9).font('Helvetica-Bold')
      doc.text('Menge', colX[0], yPos)
      doc.text('Teilenummer', colX[1], yPos)
      doc.text('Beschreibung', colX[2], yPos)
      doc.text('Einzelpreis', colX[3], yPos)
      doc.text('Status', colX[4], yPos)

      doc.moveTo(50, yPos + 12).lineTo(555, yPos + 12).stroke()
      yPos += 25

      doc.font('Helvetica').fontSize(8)
      daten.ersatzteile.forEach(teil => {
        if (yPos > 700) {
          doc.addPage()
          yPos = 40
        }

        doc.text(teil.menge.toString(), colX[0], yPos)
        doc.text(teil.teilenummer || '-', colX[1], yPos, { width: 80, ellipsis: true })
        doc.text(teil.beschreibung, colX[2], yPos, { width: 120, ellipsis: true })
        doc.text(`€${teil.einzelpreis.toFixed(2)}`, colX[3], yPos, { align: 'right' })
        doc.text(teil.status, colX[4], yPos, { align: 'right' })

        yPos += 15
      })

      yPos += 10
      doc.moveTo(50, yPos).lineTo(555, yPos).stroke()
      yPos += 20
    }

    // Bemerkungen
    if (daten.bemerkungen) {
      doc.fontSize(11).font('Helvetica-Bold').text('Bemerkungen:', 50, yPos)
      yPos += 15
      doc.fontSize(9).font('Helvetica')
        .text(daten.bemerkungen, 50, yPos, { width: 505 })
      yPos += 40
    }

    // Footer
    yPos += 20
    doc.moveTo(50, yPos).lineTo(555, yPos).stroke()
    yPos += 15

    doc.fontSize(9).font('Helvetica')
      .text('Kundensignatur: ___________________', 50, yPos)
    doc.text('Werkstatt: ___________________', 350, yPos)

    // Footer-Info
    doc.fontSize(7).font('Helvetica')
      .text('Vielen Dank für Ihr Vertrauen!', 50, 750, { align: 'center' })
    if (daten.firmaDaten.ustId) {
      doc.text(`USt-ID: ${daten.firmaDaten.ustId}`, 50, 765, { align: 'center' })
    }

    doc.end()
  })
}
