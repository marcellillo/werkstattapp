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

export async function fetchUnreadMessages(accessToken: string, top = 30): Promise<GraphMessage[]> {
  const res = await fetch(
    `${GRAPH_BASE}/me/messages?$filter=isRead eq false&$top=${top}&$select=id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments,isRead&$orderby=receivedDateTime desc`,
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
