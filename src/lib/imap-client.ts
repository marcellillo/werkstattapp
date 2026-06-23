// IMAP Client für Outlook / Microsoft 365
// Benötigt nur: E-Mail-Adresse + App-Passwort
// Dynamischer Import damit Turbopack imapflow nicht statisch bundelt

export interface ImapConfig {
  email: string
  password: string
}

export interface ImapMessage {
  uid: number
  subject: string
  from: string
  date: Date
  text: string
  html: string
  attachments: ImapAttachment[]
}

export interface ImapAttachment {
  filename: string
  contentType: string
  content: Buffer
}

function makeClient(config: ImapConfig, ImapFlow: any) {
  return new ImapFlow({
    host: 'outlook.office365.com',
    port: 993,
    secure: true,
    auth: { user: config.email, pass: config.password },
    logger: false,
  })
}

export async function fetchUnreadInvoiceMails(config: ImapConfig): Promise<ImapMessage[]> {
  const { ImapFlow } = await import('imapflow')
  const client = makeClient(config, ImapFlow)
  const messages: ImapMessage[] = []

  await client.connect()
  try {
    await client.mailboxOpen('INBOX')
    const since = new Date()
    since.setDate(since.getDate() - 14)
    const uids = await client.search({ seen: false, since })
    if (!uids || !(uids as number[]).length) return []

    for await (const msg of client.fetch((uids as number[]).slice(0, 30), {
      uid: true, envelope: true, bodyStructure: true, source: true,
    })) {
      try {
        const parsed = parseMessage(msg)
        if (parsed) messages.push(parsed)
      } catch {}
    }
  } finally {
    await client.logout()
  }
  return messages
}

function parseMessage(msg: any): ImapMessage | null {
  try {
    const source = msg.source?.toString('utf-8') ?? ''
    const subject = msg.envelope?.subject ?? ''
    const from = msg.envelope?.from?.[0]?.address ?? ''
    const date = msg.envelope?.date ?? new Date()

    const htmlMatch = source.match(/Content-Type: text\/html[^]*?\r\n\r\n([^]*?)(?:\r\n--|\r\n\r\nContent-)/i)
    const textMatch = source.match(/Content-Type: text\/plain[^]*?\r\n\r\n([^]*?)(?:\r\n--|\r\n\r\nContent-)/i)
    const html = htmlMatch?.[1] ?? ''
    const text = textMatch?.[1] ?? source.slice(0, 3000)

    const attachments: ImapAttachment[] = []
    const pdfMatches = [...source.matchAll(/Content-Type: application\/pdf[^]*?name="([^"]+)"[^]*?\r\n\r\n([A-Za-z0-9+/=\r\n]+)/gi)]
    for (const match of pdfMatches) {
      try {
        attachments.push({
          filename: match[1],
          contentType: 'application/pdf',
          content: Buffer.from(match[2].replace(/\r\n/g, ''), 'base64'),
        })
      } catch {}
    }
    return { uid: msg.uid, subject, from, date, text, html, attachments }
  } catch {
    return null
  }
}

export async function markAsRead(config: ImapConfig, uid: number): Promise<void> {
  const { ImapFlow } = await import('imapflow')
  const client = makeClient(config, ImapFlow)
  await client.connect()
  try {
    await client.mailboxOpen('INBOX')
    await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true })
  } finally {
    await client.logout()
  }
}

export async function testImapConnection(config: ImapConfig): Promise<{ ok: boolean; error?: string }> {
  const { ImapFlow } = await import('imapflow')
  const client = makeClient(config, ImapFlow)
  try {
    await client.connect()
    await client.mailboxOpen('INBOX')
    await client.logout()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
