// Microsoft Graph API Client für Outlook-E-Mails

export interface GraphEmail {
  id: string
  subject: string
  from: { emailAddress: { address: string; name: string } }
  receivedDateTime: string
  body: { content: string; contentType: string }
  isRead: boolean
}

interface TokenResponse {
  access_token: string
  expires_in: number
}

export async function getGraphToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token-Fehler: ${err}`)
  }

  const data: TokenResponse = await res.json()
  return data.access_token
}

export async function fetchNewEmails(
  token: string,
  emailAddress: string,
  since?: string,   // ISO-Datum, z.B. "2024-01-01T00:00:00Z"
): Promise<GraphEmail[]> {
  const filter = since
    ? `&$filter=receivedDateTime ge ${since} and isRead eq false`
    : '&$filter=isRead eq false'

  const url =
    `https://graph.microsoft.com/v1.0/users/${emailAddress}/messages` +
    `?$top=50&$select=id,subject,from,receivedDateTime,body,isRead${filter}` +
    `&$orderby=receivedDateTime desc`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Graph API Fehler: ${err}`)
  }

  const data = await res.json()
  return data.value ?? []
}

export interface GraphAttachment {
  id: string
  name: string
  contentType: string
  contentBytes: string  // base64
  size: number
}

export async function fetchEmailAttachments(
  token: string,
  emailAddress: string,
  messageId: string,
): Promise<GraphAttachment[]> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${emailAddress}/messages/${messageId}/attachments`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.value ?? []).filter((a: any) =>
    a.contentType === 'application/pdf' || a.contentType?.startsWith('image/')
  )
}

export async function markEmailAsRead(
  token: string,
  emailAddress: string,
  messageId: string,
): Promise<void> {
  await fetch(
    `https://graph.microsoft.com/v1.0/users/${emailAddress}/messages/${messageId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isRead: true }),
    },
  )
}
