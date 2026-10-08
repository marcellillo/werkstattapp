import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { clientIp, rateLimit } from '@/lib/rate-limit'

// Läuft komplett über den Admin-Client statt über die Session des neuen Nutzers.
// Grund: Dieses Supabase-Projekt hat mailer_autoconfirm=false (E-Mail-Bestätigung
// erforderlich), aber kein funktionierendes SMTP hinterlegt. supabase.auth.signUp()
// liefert in diesem Fall NIE eine aktive Session, sondern nur einen unbestätigten
// User. Ein Accept-Flow, der auf getUser() (= vorhandene Session) angewiesen ist,
// schlägt dadurch praktisch immer mit 401 fehl -- der Auth-User wurde aber bereits
// angelegt und bleibt als Karteileiche ohne betrieb_users-Zeile zurück (genau der
// Fall, der bei "Enayat.hayat@gmx.de" von Hand nachkorrigiert werden musste).
// Hier wird der User stattdessen direkt per Admin-API angelegt/aktualisiert und
// sofort bestätigt, sodass die Registrierung ohne echtes SMTP funktioniert.
export async function POST(req: NextRequest) {
  try {
    // Token raten/durchprobieren und Massen-Registrierung verhindern
    const limit = await rateLimit(`einladung-annehmen:${clientIp(req)}`, 10, 600)
    if (limit) return limit

    const { token, password } = await req.json().catch(() => ({}))
    if (!token || !password || typeof token !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Token und Passwort erforderlich' }, { status: 400 })
    }
    if (password.length < 10) {
      return NextResponse.json({ error: 'Passwort muss mindestens 10 Zeichen lang sein' }, { status: 400 })
    }
    if (password.length > 200) {
      return NextResponse.json({ error: 'Passwort ist zu lang' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get invitation
    const { data: invitation, error: invError } = await admin
      .from('user_invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (invError || !invitation) {
      return NextResponse.json({ error: 'Einladung ungültig' }, { status: 404 })
    }

    // Check if expired
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Einladung wurde bereits verwendet oder ist abgelaufen' }, { status: 400 })
    }

    if (new Date(invitation.abgelaufen_am) < new Date()) {
      await admin.from('user_invitations').update({ status: 'expired' }).eq('id', invitation.id)
      return NextResponse.json({ error: 'Einladung ist abgelaufen' }, { status: 400 })
    }

    // Auth-User anlegen -- oder, falls ein vorheriger (fehlgeschlagener) Versuch
    // bereits einen unbestätigten User für diese Email angelegt hat, diesen mit
    // dem neuen Passwort aktualisieren und bestätigen. Macht den Flow idempotent
    // gegenüber Wiederholungsversuchen mit demselben Einladungslink.
    const listResult = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (listResult.error) throw listResult.error
    const alleUsers = listResult.data.users as { id: string; email?: string; last_sign_in_at?: string | null }[]
    const existingUser = alleUsers.find(
      u => u.email?.toLowerCase() === invitation.email.toLowerCase()
    )

    // SICHERHEIT: Ein Konto, mit dem sich schon jemand angemeldet hat, darf über einen Einladungslink NIE ein
    // neues Passwort bekommen -- sonst könnte jeder Admin, der die E-Mail-Adresse eines fremden Kontos einlädt,
    // dieses Konto übernehmen. Solche Konten werden nur dem Betrieb hinzugefügt und melden sich wie gewohnt an.
    const bestehendesAktivesKonto = !!existingUser?.last_sign_in_at

    let userId: string
    if (existingUser && bestehendesAktivesKonto) {
      userId = existingUser.id
    } else if (existingUser) {
      const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
      })
      if (updateErr) throw updateErr
      userId = updated.user.id
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
      })
      if (createErr) throw createErr
      userId = created.user.id
    }

    // Accept invitation - add user to betrieb
    const { data: existingMembership } = await admin
      .from('betrieb_users')
      .select('id')
      .eq('betrieb_id', invitation.betrieb_id)
      .eq('profile_id', userId)
      .maybeSingle()

    const membershipError = existingMembership
      ? (await admin
          .from('betrieb_users')
          .update({ role: invitation.rolle })
          .eq('betrieb_id', invitation.betrieb_id)
          .eq('profile_id', userId)
        ).error
      : (await admin.from('betrieb_users').insert({
          betrieb_id: invitation.betrieb_id,
          profile_id: userId,
          role: invitation.rolle,
          is_primary: false,
        })).error

    if (membershipError) throw membershipError

    // Mark invitation as accepted
    await admin
      .from('user_invitations')
      .update({
        status: 'accepted',
        akzeptiert_am: new Date().toISOString(),
      })
      .eq('id', invitation.id)

    return NextResponse.json({
      success: true,
      betriebId: invitation.betrieb_id,
      rolle: invitation.rolle,
      bestehendesKonto: bestehendesAktivesKonto,
    })
  } catch (error: any) {
    console.error('[Accept Invitation] Error:', error)
    return NextResponse.json({ error: 'Die Einladung konnte nicht angenommen werden. Bitte später erneut versuchen.' }, { status: 500 })
  }
}
