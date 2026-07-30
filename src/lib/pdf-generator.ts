import PDFDocument from 'pdfkit'
import { RechnungsPosition } from './validierung-rechnungen'

export interface KostenvoranschlagPDF {
  nummer: string
  datum: string
  kundenName: string
  kundenAdresse: string
  kundenOrt: string
  fahrzeug: {
    marke: string
    modell: string
    fin: string
    kennzeichen?: string
  }
  positionen: RechnungsPosition[]
  summeNetto: number
  mehrwertsteuer: number
  summeBrutto: number
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
 * Generiert PDF-Kostenvoranschlag
 */
export async function generateKostenvoranschlagPDF(daten: KostenvoranschlagPDF): Promise<Buffer> {
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
    doc.fontSize(10).font('Helvetica').text(`${daten.firmaDaten.strasse}, ${daten.firmaDaten.plz} ${daten.firmaDaten.ort}`)
    if (daten.firmaDaten.telefon) doc.text(`Tel: ${daten.firmaDaten.telefon}`)
    if (daten.firmaDaten.email) doc.text(`Email: ${daten.firmaDaten.email}`)

    doc.moveTo(40, 120).lineTo(555, 120).stroke()

    // Titel
    doc.fontSize(18).font('Helvetica-Bold').text('KOSTENVORANSCHLAG', { align: 'center' })
    doc.fontSize(10).font('Helvetica')

    // Nummern & Datum
    doc.text(`Nummer: ${daten.nummer}`, 50, 160)
    doc.text(`Datum: ${daten.datum}`, 350, 160)

    // Kunde
    doc.fontSize(11).font('Helvetica-Bold').text('Kunde:', 50, 200)
    doc.fontSize(10).font('Helvetica')
    doc.text(daten.kundenName, 50, 220)
    doc.text(daten.kundenAdresse, 50, 235)
    doc.text(daten.kundenOrt, 50, 250)

    // Fahrzeug
    doc.fontSize(11).font('Helvetica-Bold').text('Fahrzeug:', 350, 200)
    doc.fontSize(10).font('Helvetica')
    doc.text(`${daten.fahrzeug.marke} ${daten.fahrzeug.modell}`, 350, 220)
    doc.text(`FIN: ${daten.fahrzeug.fin}`, 350, 235)
    if (daten.fahrzeug.kennzeichen) doc.text(`Kennzeichen: ${daten.fahrzeug.kennzeichen}`, 350, 250)

    // Positionen Tabelle
    const tableTop = 300
    const colX = [50, 100, 350, 450, 520]

    doc.fontSize(10).font('Helvetica-Bold')
    doc.text('Pos', colX[0], tableTop)
    doc.text('Menge', colX[1], tableTop)
    doc.text('Beschreibung', colX[2], tableTop)
    doc.text('Preis', colX[3], tableTop)
    doc.text('Summe', colX[4], tableTop, { align: 'right' })

    doc.moveTo(50, tableTop + 15).lineTo(555, tableTop + 15).stroke()

    let yPos = tableTop + 30
    doc.font('Helvetica').fontSize(9)

    daten.positionen.forEach((pos, idx) => {
      if (yPos > 700) {
        doc.addPage()
        yPos = 40
      }

      doc.text((idx + 1).toString(), colX[0], yPos)
      doc.text(pos.menge.toString(), colX[1], yPos)
      doc.text(pos.beschreibung, colX[2], yPos, { width: 140, ellipsis: true })
      doc.text(`€${pos.preis.toFixed(2)}`, colX[3], yPos, { align: 'right' })
      doc.text(`€${pos.summe.toFixed(2)}`, colX[4], yPos, { align: 'right' })

      yPos += 20
    })

    yPos += 10
    doc.moveTo(50, yPos).lineTo(555, yPos).stroke()

    yPos += 15
    doc.fontSize(11).font('Helvetica-Bold')
    doc.text('Summe Netto:', 350, yPos)
    doc.text(`€${daten.summeNetto.toFixed(2)}`, 500, yPos, { align: 'right' })

    yPos += 20
    doc.text('MwSt (19%):', 350, yPos)
    doc.text(`€${daten.mehrwertsteuer.toFixed(2)}`, 500, yPos, { align: 'right' })

    yPos += 20
    doc.font('Helvetica-Bold').fontSize(12)
    doc.text('SUMME BRUTTO:', 350, yPos)
    doc.text(`€${daten.summeBrutto.toFixed(2)}`, 500, yPos, { align: 'right' })

    // Notizen
    if (daten.notizen) {
      yPos += 40
      doc.fontSize(10).font('Helvetica-Bold').text('Notizen:')
      doc.font('Helvetica').text(daten.notizen, { width: 505 })
    }

    // Footer
    doc.fontSize(8).font('Helvetica').text('Dieses Kostenvoranschlag ist unverbindlich.', 50, 750, { align: 'center' })
    if (daten.firmaDaten.ustId) {
      doc.text(`USt-ID: ${daten.firmaDaten.ustId}`, 50, 765, { align: 'center' })
    }

    doc.end()
  })
}
