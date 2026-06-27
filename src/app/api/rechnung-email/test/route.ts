import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const admin = createAdminClient()
  const { data: rows } = await admin.from('werkstatt_einstellungen').select('schluessel, wert')
  const cfg: Record<string, string> = {}
  for (const r of rows ?? []) if (r.wert) cfg[r.schluessel] = r.wert

  const resendKey = cfg.resend_api_key || process.env.RESEND_API_KEY
  if (!resendKey) return NextResponse.json({ error: 'Kein Resend API-Key konfiguriert' }, { status: 400 })

  const absender = cfg.firma_absender_email || 'onboarding@resend.dev'
  const firmaName = cfg.firma_name || 'Kfz-Werkstatt'

  // Empfänger = eingeloggter User
  const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).maybeSingle()
  const an = profile?.email || user.email
  if (!an) return NextResponse.json({ error: 'Keine E-Mail-Adresse für den Test gefunden' }, { status: 400 })

  const resend = new Resend(resendKey)
  const { error } = await resend.emails.send({
    from: `${firmaName} <${absender}>`,
    to: an,
    subject: `✅ E-Mail-Versand funktioniert — ${firmaName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:32px auto;background:#f8fafc;border-radius:12px;overflow:hidden;">
        <div style="background:#1e293b;padding:24px 32px;">
          <div style="font-size:18px;font-weight:700;color:#ea580c;">${firmaName}</div>
        </div>
        <div style="padding:32px;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#15803d;">✅ E-Mail-Versand funktioniert!</h2>
          <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 16px;">
            Der E-Mail-Versand über Resend ist korrekt eingerichtet.<br>
            Rechnungen und Kundenbenachrichtigungen werden ab sofort automatisch versendet.
          </p>
          <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;padding:12px 16px;font-size:12px;color:#166534;">
            Absender: <strong>${absender}</strong><br>
            Empfänger: <strong>${an}</strong>
          </div>
        </div>
      </div>
    `,
  })

  if (error) {
    return NextResponse.json({ error: (error as any).message ?? 'Sendefehler' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, an })
}
