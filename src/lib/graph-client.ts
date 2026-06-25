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

export function getOAuthUrl(clientId: string, tenantId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: 'https://graph.microsoft.com/Mail.Read offline_access',
    prompt: 'select_account',
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
  subject: string
  from: { emailAddress: { address: string; name: string } }
  receivedDateTime: string
  bodyPreview: string
  body: { content: string; contentType: string }
  hasAttachments: boolean
  isRead: boolean
}

export async function fetchUnreadMessages(accessToken: string, top = 50): Promise<GraphMessage[]> {
  // Letzte 14 Tage abrufen (nicht nur ungelesen) — Duplikat-Check in route.ts verhindert doppelte Imports
  const seit = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const res = await fetch(
    `${GRAPH_BASE}/me/mailFolders/inbox/messages?$filter=receivedDateTime ge ${seit}&$top=${top}&$select=id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments,isRead&$orderby=receivedDateTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message ?? `Graph API Fehler: ${res.status}`)
  }
  const data = await res.json()
  return data.value ?? []
}

export async function markMessageAsRead(accessToken: string, messageId: string): Promise<void> {
  await fetch(`${GRAPH_BASE}/me/messages/${messageId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isRead: true }),
  })
}

export interface GraphAttachment {
  id: string
  name: string
  contentType: string
  contentBytes: string // base64
  size: number
}

export async function fetchAttachments(accessToken: string, messageId: string): Promise<GraphAttachment[]> {
  const res = await fetch(
    `${GRAPH_BASE}/me/messages/${messageId}/attachments`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Anhänge-Fehler: ${res.status} ${err.error?.message ?? ''}`)
  }
  const data = await res.json()
  return (data.value ?? []).filter((a: any) => {
    const ct: string = a.contentType ?? ''
    const name: string = (a.name ?? '').toLowerCase()
    return ct === 'application/pdf' ||
      ct === 'application/octet-stream' ||
      ct.startsWith('image/') ||
      name.endsWith('.pdf') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png')
  }).map((a: any) => {
    // Korrigiere contentType anhand Dateiname falls nötig
    const name: string = (a.name ?? '').toLowerCase()
    if (a.contentType === 'application/octet-stream' && name.endsWith('.pdf')) {
      return { ...a, contentType: 'application/pdf' }
    }
    return a
  })
}
