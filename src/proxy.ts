import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register')
  // Passwort-Reset: der Token steckt im URL-Fragment (#access_token=...), das der
  // Server nie sieht -- die Middleware darf hier also nicht anhand von "user
  // vorhanden?" umleiten, sonst geht der Fragment-Teil beim Redirect verloren,
  // bevor der Browser-Client ihn verarbeiten und die Recovery-Session herstellen kann.
  const isPasswordReset = request.nextUrl.pathname.startsWith('/passwort-zuruecksetzen')
  const isPublicApi =
    request.nextUrl.pathname.startsWith('/api/buchen') ||
    request.nextUrl.pathname.startsWith('/status/') ||
    // Datenquelle der öffentlichen Kunden-Statusseite (/status/[id]); ohne diese Freigabe wurden
    // nicht angemeldete Kunden zur Login-Seite umgeleitet und sahen nie ihren Auftragsstatus
    request.nextUrl.pathname.startsWith('/api/status/') ||
    // Kunden-Freigabe des Kostenvoranschlags per Link (Berechtigung = geheimes Token im Link)
    request.nextUrl.pathname.startsWith('/freigabe/') ||
    request.nextUrl.pathname.startsWith('/api/freigabe/') ||
    request.nextUrl.pathname.startsWith('/api/invitations/get') ||
    request.nextUrl.pathname.startsWith('/api/invitations/accept') ||
    // Cron-Aufrufe haben keine Nutzer-Session; die Route prüft das CRON_SECRET selbst
    request.nextUrl.pathname.startsWith('/api/cron/')
  const isPublicRoute = isAuthRoute || isPasswordReset || request.nextUrl.pathname === '/' || isPublicApi

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
