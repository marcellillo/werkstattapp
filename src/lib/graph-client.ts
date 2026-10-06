// Microsoft Graph API Client für E-Mail-Sync

export interface GraphConfig {
  clientId: string
  tenantId: string
  clientSecret: string
  refreshToken: string
  email: string
}

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://werkstatt-app-umber.vercel.app'}/api/graph/callback`

export function getOAuthUrl(clientId: string, tenantId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: 'https://graph.microsoft.com/Mail.Read offline_access',
    prompt: 'select_account',
    state,
  })
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  tenantId: string,
  clientSecret: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error_description ?? 'Token-Austausch fehlgeschlagen')
  return { accessToken: data.access_token, refreshToken: data.refresh_token }
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  tenantId: string,
  clientSecret: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Mail.Read offline_access',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error_description ?? 'Token-Refresh fehlgeschlagen')
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
  }
}

export interface GraphMessage {
  id: string
  internetMessageId?: string
  subject: string
  from: { emailAddress: { address: string; name: string } }
  receivedDateTime: string
  bodyPreview: string
  body?: { content: string; contentType: string } // nur nach fetchMessageBody()
  hasAttachments: boolean
  isRead: boolean
  webLink?: string
}

// Eindeutiger Schlüssel einer Nachricht, der auch beim Verschieben zwischen Ordnern gleich bleibt
export function nachrichtenSchluessel(msg: GraphMessage): string {
  return msg.internetMessageId || msg.id
}

// Nachrichten der letzten `tage` Tage aus dem Posteingang, seitenweise (Graph liefert höchstens
// 50 pro Seite). Ob eine Mail schon verarbeitet wurde, entscheidet der Aufrufer (email_verarbeitet).
export async function fetchMessages(accessToken: string, tage = 14, max = 200): Promise<GraphMessage[]> {
  const seit = new Date(Date.now() - tage * 24 * 60 * 60 * 1000).toISOString()
  const select = 'id,internetMessageId,subject,from,receivedDateTime,bodyPreview,hasAttachments,isRead,webLink'
  let url: string | null =
    `${GRAPH_BASE}/me/mailFolders/inbox/messages?$filter=receivedDateTime ge ${seit}&$top=50&$select=${select}&$orderby=receivedDateTime desc`

  const alle: GraphMessage[] = []
  while (url && alle.length < max) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message ?? `Graph API Fehler: ${res.status}`)
    }
    const data: { value?: GraphMessage[]; '@odata.nextLink'?: string } = await res.json()
    alle.push(...(data.value ?? []))
    url = data['@odata.nextLink'] ?? null
  }
  return alle.slice(0, max)
}

// Mailtext einzeln nachladen (die Liste enthält ihn aus Platzgründen nicht)
export async function fetchMessageBody(accessToken: string, messageId: string): Promise<{ content: string; contentType: string }> {
  const res = await fetch(`${GRAPH_BASE}/me/messages/${encodeURIComponent(messageId)}?$select=body`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Mailtext konnte nicht geladen werden: ${res.status}`)
  const data = await res.json()
  return data.body ?? { content: '', contentType: 'text' }
}

export interface GraphAttachment {
  id: string
  name: string
  contentType: string
  contentBytes: string // base64
  size: number
}

const MIN_BILD_BYTES = 50 * 1024 // kleinere Bilder sind fast immer Signatur-Logos
const MAX_ANHANG_BYTES = 20 * 1024 * 1024

// Nur Anhänge, die eine Rechnung sein können: PDFs und echte (nicht eingebettete) Fotos/Scans.
export async function fetchAttachments(accessToken: string, messageId: string): Promise<GraphAttachment[]> {
  const basis = `${GRAPH_BASE}/me/messages/${encodeURIComponent(messageId)}/attachments`
  const res = await fetch(basis, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Anhänge-Fehler: ${res.status} ${err.error?.message ?? ''}`)
  }
  const data = await res.json()

  const ergebnis: GraphAttachment[] = []
  for (const a of data.value ?? []) {
    if (a['@odata.type'] && a['@odata.type'] !== '#microsoft.graph.fileAttachment') continue
    if (a.isInline) continue
    const name: string = a.name ?? ''
    const lower = name.toLowerCase()
    const ct: string = (a.contentType ?? '').toLowerCase()
    const size: number = a.size ?? 0
    if (size > MAX_ANHANG_BYTES) continue

    const istPdf = ct === 'application/pdf' || lower.endsWith('.pdf')
    const istBild = /\.(jpe?g|png|webp|gif)$/.test(lower) || ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(ct)
    if (!istPdf && !(istBild && size >= MIN_BILD_BYTES)) continue

    let bytes: string | undefined = a.contentBytes
    if (!bytes) {
      // Große Anhänge liefert die Liste ohne Inhalt: einzeln als Binärdaten holen
      const r = await fetch(`${basis}/${encodeURIComponent(a.id)}/$value`, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!r.ok) continue
      bytes = Buffer.from(await r.arrayBuffer()).toString('base64')
    }
    ergebnis.push({
      id: a.id,
      name,
      contentType: istPdf ? 'application/pdf' : ct || 'application/octet-stream',
      contentBytes: bytes,
      size,
    })
  }
  return ergebnis
}
