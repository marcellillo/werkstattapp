import PDFDocument from 'pdfkit'

export interface VorvertragPDF {
  // Dokument
  nummer: string
  datum: string

  // Käufer
  kaeuferName: string
  kaeuferStrasse: string
  kaeuferPlz: string
  kaeuferOrt: string
  kaeuferTelefon?: string

  // Fahrzeug
  fahrzeug: {
    marke: string
    modell: string
    fin: string
    kennzeichen?: string
    baujahr: string
    farbe: string
    kilometerstand: number
  }

  // Kaufpreis & Bedingungen
  kaufpreis: number
  anzahlung?: number
  restzahlung?: number
  zahlungsfrist?: string
  uebergabedatum?: string

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

  notizen?: string
}

/**
 * Generiert PDF-Vorvertrag für Fahrzeugverkauf
 */
export async function generateVorvertragPDF(daten: VorvertragPDF): Promise<Buffer> {
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
    doc.fontSize(18).font('Helvetica-Bold').text('KAUFVERTRAG / VORVERTRAG', { align: 'center' })
    doc.fontSize(10).font('Helvetica').text(`Vertrag Nr: ${daten.nummer}`, { align: 'center' })
    doc.text(`Datum: ${daten.datum}`, { align: 'center' })

    doc.moveDown(0.5)

    // Vertragsparteien
    doc.fontSize(11).font('Helvetica-Bold').text('1. VERTRAGSPARTEIEN')
    doc.fontSize(10).font('Helvetica')

    doc.text('VERKÄUFER:', 50, 200)
    doc.text(daten.firmaDaten.name, 50, 215)
    doc.text(`${daten.firmaDaten.strasse}, ${daten.firmaDaten.plz} ${daten.firmaDaten.ort}`, 50, 230)

    doc.text('KÄUFER:', 350, 200)
    doc.text(daten.kaeuferName, 350, 215)
    doc.text(daten.kaeuferStrasse, 350, 230)
    doc.text(`${daten.kaeuferPlz} ${daten.kaeuferOrt}`, 350, 245)
    if (daten.kaeuferTelefon) doc.text(`Tel: ${daten.kaeuferTelefon}`, 350, 260)

    // Fahzeug
    let yPos = 290
    doc.fontSize(11).font('Helvetica-Bold').text('2. FAHRZEUG')
    doc.fontSize(10).font('Helvetica')

    const fahrzeugInfo = [
      `Marke/Modell: ${daten.fahrzeug.marke} ${daten.fahrzeug.modell}`,
      `Baujahr: ${daten.fahrzeug.baujahr}`,
      `Fahrgestellnummer (FIN): ${daten.fahrzeug.fin}`,
      `Kennzeichen: ${daten.fahrzeug.kennzeichen || '-'}`,
      `Farbe: ${daten.fahrzeug.farbe}`,
      `Kilometerstand: ${daten.fahrzeug.kilometerstand.toLocaleString('de-DE')} km`,
    ]

    yPos = 320
    fahrzeugInfo.forEach(info => {
      doc.text(info, 50, yPos)
      yPos += 18
    })

    // Kaufpreis
    yPos += 10
    doc.fontSize(11).font('Helvetica-Bold').text('3. KAUFPREIS')
    doc.fontSize(10).font('Helvetica')

    yPos += 25
    doc.text(`Kaufpreis (gesamt): €${daten.kaufpreis.toFixed(2)}`, 50, yPos)
    yPos += 20

    if (daten.anzahlung) {
      doc.text(`Anzahlung: €${daten.anzahlung.toFixed(2)}`, 50, yPos)
      yPos += 20
    }

    if (daten.restzahlung) {
      doc.text(`Restzahlung: €${daten.restzahlung.toFixed(2)}`, 50, yPos)
      yPos += 20
    }

    // Zahlungsbedingungen
    yPos += 10
    doc.fontSize(11).font('Helvetica-Bold').text('4. ZAHLUNGSBEDINGUNGEN')
    doc.fontSize(10).font('Helvetica')

    yPos += 25
    const zahlungstext = daten.zahlungsfrist || 'Die Zahlung ist fällig bei Übergabe des Fahrzeugs.'
    doc.text(zahlungstext, 50, yPos, { width: 505 })

    // Übergabedatum
    yPos += 60
    doc.fontSize(11).font('Helvetica-Bold').text('5. ÜBERGABEDATUM')
    doc.fontSize(10).font('Helvetica')
    yPos += 25
    const uebergabe = daten.uebergabedatum || 'Nach Zahlungseingang'
    doc.text(`Übergabedatum: ${uebergabe}`, 50, yPos)

    // Mängelhaftung
    yPos += 50
    doc.fontSize(11).font('Helvetica-Bold').text('6. MÄNGELHAFTUNG / GEWÄHRLEISTUNG')
    doc.fontSize(10).font('Helvetica')
    yPos += 25
    doc.text(
      'Das Fahrzeug wird in seinem gegenwärtigen Zustand verkauft. Der Käufer bestätigt, dass er das Fahrzeug inspiziert und besichtigt hat.',
      50,
      yPos,
      { width: 505 }
    )

    // Unterschriftsblock
    yPos += 80
    doc.moveTo(50, yPos).lineTo(555, yPos).stroke()

    yPos += 20
    doc.fontSize(10).font('Helvetica')
    doc.text('Verkäufer:', 50, yPos)
    doc.text('Käufer:', 350, yPos)

    yPos += 60
    doc.text('_________________________', 50, yPos)
    doc.text('_________________________', 350, yPos)

    yPos += 15
    doc.fontSize(8)
    doc.text(`${daten.firmaDaten.name}`, 50, yPos)
    doc.text(daten.kaeuferName, 350, yPos)

    // Footer
    doc.fontSize(8).text('Dieses Vorvertrag ist bindend.', 50, 750, { align: 'center' })
    if (daten.firmaDaten.ustId) {
      doc.text(`USt-ID: ${daten.firmaDaten.ustId}`, 50, 765, { align: 'center' })
    }

    doc.end()
  })
}
