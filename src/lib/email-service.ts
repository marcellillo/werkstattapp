// Email-Service für Versand von Mails (Resend API oder ähnliches)

interface InviteEmailParams {
  email: string
  betriebName: string
  role: string
  inviteToken: string
}

interface InvitedUserData {
  email: string
  betriebId: string
  role: string
  inviteToken: string
}

export async function sendInviteEmail(params: InviteEmailParams) {
  const { email, betriebName, role, inviteToken } = params

  const registrationLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/signup?invite=${inviteToken}`

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .body { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 4px; text-decoration: none; margin: 20px 0; }
        .role-badge { display: inline-block; background: #e0e7ff; color: #667eea; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .footer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔧 Werkstatt-App</h1>
          <p>Sie wurden eingeladen!</p>
        </div>

        <div class="body">
          <p>Hallo!</p>

          <p><strong>${betriebName}</strong> lädt Sie ein, der Werkstatt-App beizutreten.</p>

          <p>Ihre Rolle: <span class="role-badge">${roleLabel(role)}</span></p>

          <p>Klicken Sie auf den Link unten, um Ihr Konto zu registrieren:</p>

          <p style="text-align: center;">
            <a href="${registrationLink}" class="button">Jetzt registrieren</a>
          </p>

          <p style="font-size: 12px; color: #666;">
            Oder kopieren Sie diesen Link:<br>
            <code>${registrationLink}</code>
          </p>

          <p style="margin-top: 30px; font-size: 14px;">
            Falls Sie diese Einladung nicht erwartet haben, ignorieren Sie diese E-Mail.
          </p>

          <div class="footer">
            <p>© 2026 Werkstatt-App. Alle Rechte vorbehalten.</p>
            <p>Sie erhalten diese E-Mail, weil Sie zu einer Werkstatt eingeladen wurden.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY nicht konfiguriert')
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@werkstatt-app.de',
        to: email,
        subject: `Willkommen bei ${betriebName} – Werkstatt-App Einladung`,
        html: htmlContent,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`Resend API Error: ${data.message || 'Email-Versand fehlgeschlagen'}`)
    }

    console.log(`✅ Invite-Email versendet an ${email} (ID: ${data.id})`)
    return { success: true, email, messageId: data.id }
  } catch (error) {
    console.error('❌ Email-Versand fehlgeschlagen:', error)
    throw error
  }
}

export async function parseInviteToken(token: string): Promise<InvitedUserData> {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const data = JSON.parse(decoded)

    // Check if token is not older than 7 days
    const ageInDays = (Date.now() - data.createdAt) / (1000 * 60 * 60 * 24)
    if (ageInDays > 7) {
      throw new Error('Einladungs-Link ist abgelaufen (älter als 7 Tage)')
    }

    return {
      email: data.email,
      betriebId: data.betriebId,
      role: data.role,
      inviteToken: token,
    }
  } catch (error) {
    throw new Error('Ungültiger Einladungs-Link')
  }
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'Admin',
    werkstattmeister: 'Werkstattmeister',
    mechaniker: 'Mechaniker',
    buchhalter: 'Buchhalter',
  }
  return labels[role] || role
}
