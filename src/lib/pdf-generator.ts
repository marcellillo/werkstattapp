import * as fs from 'fs'
import * as path from 'path'

interface PDFData {
  [key: string]: any
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderBlocks(html: string, data: PDFData): string {
  return html.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, (_match, key, inner) => {
    const value = data[key]

    if (Array.isArray(value)) {
      return value
        .map((item) =>
          inner.replace(/{{(\w+)}}/g, (_m: string, field: string) => {
            const fieldValue = item?.[field]
            return fieldValue !== undefined && fieldValue !== null ? escapeHtml(String(fieldValue)) : ''
          })
        )
        .join('')
    }

    if (value) {
      // Truthy scalar (e.g. logoBase64) — render once, substituting against the outer data
      return inner.replace(/{{(\w+)}}/g, (_m: string, field: string) => {
        const fieldValue = data[field]
        return fieldValue !== undefined && fieldValue !== null ? String(fieldValue) : ''
      })
    }

    return ''
  })
}

export async function generatePDF(templateName: string, data: PDFData): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'src/lib/pdf-templates', `${templateName}.html`)

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template nicht gefunden: ${templateName}`)
  }

  let html = fs.readFileSync(templatePath, 'utf-8')

  // Wiederholte Blöcke ({{#name}}...{{/name}}) zuerst auflösen
  html = renderBlocks(html, data)

  // Verbleibende einfache Platzhalter ersetzen
  html = html.replace(/{{(\w+)}}/g, (_match, key) => {
    const value = data[key]
    return value !== undefined && value !== null ? String(value) : ''
  })

  try {
    // puppeteer v25+ ist ein reines ESM-Paket — require() liefert kein nutzbares Modul
    const puppeteer = (await import('puppeteer')).default
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      printBackground: true,
    })

    await browser.close()
    return Buffer.from(pdfBuffer)
  } catch (error) {
    console.error('[PDF] Fehler:', error)
    throw error
  }
}
