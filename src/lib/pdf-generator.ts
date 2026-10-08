import * as fs from 'fs'
import * as path from 'path'

interface PDFData {
  [key: string]: any
}

export interface PDFOptionen {
  // true (Standard): Daten stammen von unseren eigenen Server-Routen; nur Schlüssel, die als "HTML-Baustein"
  // gelten (siehe unten), werden unverändert eingesetzt -- und dürfen deshalb nur Text enthalten, der dort
  // bereits maskiert wurde. false: Daten kommen vom Browser des Nutzers -> ALLES wird maskiert.
  vertrauenswuerdig?: boolean
}

// Schlüssel, deren Wert absichtlich HTML-Markup enthält (von unserem Code gebaut, Nutzertexte darin maskiert)
const HTML_BAUSTEINE = new Set(['kundeBlock', 'firmaSteuerBlock', 'bankBlock', 'betriebTelZeile'])
const istHtmlBaustein = (key: string) => /Html$/.test(key) || HTML_BAUSTEINE.has(key)

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Logos kommen als Data-URL aus den Einstellungen; nur echte Rasterbilder zulassen
function sicheresLogo(value: unknown): string {
  const s = typeof value === 'string' ? value.trim() : ''
  return /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : ''
}

function wert(key: string, value: unknown, vertrauenswuerdig: boolean): string {
  if (value === undefined || value === null) return ''
  if (key === 'logoBase64') return sicheresLogo(value)
  const s = String(value)
  return vertrauenswuerdig && istHtmlBaustein(key) ? s : escapeHtml(s)
}

function renderBlocks(html: string, data: PDFData, vertrauenswuerdig: boolean): string {
  return html.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, (_match, key, inner) => {
    const value = key === 'logoBase64' ? sicheresLogo(data[key]) : data[key]

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
      return inner.replace(/{{(\w+)}}/g, (_m: string, field: string) => wert(field, data[field], vertrauenswuerdig))
    }

    return ''
  })
}

// Das PDF-HTML darf nichts nachladen, keine Skripte/Frames/Formulare enthalten: Content-Security-Policy
// als erstes Element im <head> (spätere Einschleusungen können sie nicht mehr entfernen).
const CSP_META =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'none'">`

function mitCsp(html: string): string {
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => m + CSP_META)
    : CSP_META + html
}

// Umgebungsvariablen, die der Browser-Prozess wirklich braucht (Pfade, Schriften, Bibliotheken).
// ALLES andere (Datenbank-/API-Schlüssel, Cron-Secret, ...) bleibt dem Browser vorenthalten.
const BROWSER_ENV = [
  'PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'TZ', 'LD_LIBRARY_PATH',
  'FONTCONFIG_PATH', 'FONTCONFIG_FILE', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
  'LAMBDA_TASK_ROOT', 'LAMBDA_RUNTIME_DIR', 'AWS_EXECUTION_ENV', 'AWS_LAMBDA_JS_RUNTIME', 'NODE_PATH',
]
function browserUmgebung(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const k of BROWSER_ENV) if (process.env[k]) env[k] = process.env[k] as string
  if (!env.HOME) env.HOME = '/tmp'
  return env
}

// Schalter des Serverless-Chromium, die die Browser-Sicherheit abschalten, fliegen raus
const UNSICHERE_ARGS = /^--(disable-web-security|allow-running-insecure-content|disable-site-isolation-trials|allow-file-access-from-files|allow-file-access|disable-features=.*IsolateOrigins.*)/

export async function generatePDF(templateName: string, data: PDFData, optionen: PDFOptionen = {}): Promise<Buffer> {
  const vertrauenswuerdig = optionen.vertrauenswuerdig !== false
  const templatePath = path.join(process.cwd(), 'src/lib/pdf-templates', `${templateName}.html`)

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template nicht gefunden: ${templateName}`)
  }

  let html = fs.readFileSync(templatePath, 'utf-8')

  // Wiederholte Blöcke ({{#name}}...{{/name}}) zuerst auflösen
  html = renderBlocks(html, data, vertrauenswuerdig)

  // Verbleibende einfache Platzhalter ersetzen (Nutzertexte werden maskiert)
  html = html.replace(/{{(\w+)}}/g, (_match, key) => wert(key, data[key], vertrauenswuerdig))
  html = mitCsp(html)

  let browser: any
  try {
    // Auf Vercel gibt es kein vorinstalliertes Chrome -- das volle "puppeteer"-Paket
    // lädt seinen Chromium-Download nur lokal beim npm install, in der Serverless-
    // Umgebung fehlt das Binary ("Could not find Chrome"). Dort läuft stattdessen
    // puppeteer-core mit dem für Lambda/Vercel gebauten @sparticuz/chromium-Binary.
    // Lokal (Windows/macOS/Linux-Desktop) bleibt es beim vollen puppeteer, da
    // @sparticuz/chromium ein reines Linux-Serverless-Binary ist.
    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)

    if (isServerless) {
      const chromium = (await import('@sparticuz/chromium')).default
      const puppeteerCore = (await import('puppeteer-core')).default
      const executablePath = await chromium.executablePath() // setzt ggf. LD_LIBRARY_PATH/FONTCONFIG_PATH
      browser = await puppeteerCore.launch({
        args: chromium.args.filter((a: string) => !UNSICHERE_ARGS.test(a)),
        executablePath,
        headless: true,
        env: browserUmgebung(),
      })
    } else {
      // puppeteer v25+ ist ein reines ESM-Paket — require() liefert kein nutzbares Modul
      const puppeteer = (await import('puppeteer')).default
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    }

    const page = await browser.newPage()
    // Gürtel und Hosenträger: kein JavaScript, und außer eingebetteten data:-Bildern wird nichts geladen
    await page.setJavaScriptEnabled(false).catch(() => {})
    await page.setRequestInterception(true)
    page.on('request', (req: any) => {
      const url: string = req.url()
      if (url.startsWith('data:') || url === 'about:blank') req.continue()
      else req.abort('blockedbyclient')
    })
    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      printBackground: true,
    })

    return Buffer.from(pdfBuffer)
  } catch (error) {
    console.error('[PDF] Fehler:', error)
    throw error
  } finally {
    // Der Browser muss IMMER geschlossen werden (sonst bleiben Prozesse hängen)
    if (browser) await browser.close().catch(() => {})
  }
}
