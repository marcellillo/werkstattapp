import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
})

// Content-Security-Policy. Next.js setzt eigene Inline-Skripte (Hydration) ein, deshalb 'unsafe-inline' bei
// script-src; trotzdem sperrt die Richtlinie fremde Skript-Quellen, Plug-ins (object-src), Einbetten der
// App in fremde Seiten (frame-ancestors), fremde <base>-Adressen und fremde Formularziele.
// Außerhalb der Entwicklung zunächst nur melden (Report-Only), nach Prüfung auf "erzwingen" umstellen.
const SUPABASE = 'https://wjglxskeqfzwonugsquo.supabase.co'
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE} https://img.classistatic.de https://unpkg.com https://raw.githubusercontent.com https://*.tile.openstreetmap.org`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE} wss://wjglxskeqfzwonugsquo.supabase.co https://nominatim.openstreetmap.org`,
  `frame-src 'self' blob: ${SUPABASE}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  turbopack: {},
  // Sicherheits-Header für alle Antworten. Schnittstellen liefern angemeldete Daten und dürfen
  // nirgends zwischengespeichert werden.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), payment=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ]
  },
  // @sparticuz/chromium liefert vorkompilierte Binärdateien (.br) aus, die an ihrem
  // node_modules-Pfad liegen bleiben müssen -- der Bundler darf sie nicht anfassen/
  // verschieben, sonst findet chromium.executablePath() sie zur Laufzeit nicht mehr
  // ("input directory .../@sparticuz/chromium/bin does not exist").
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // serverExternalPackages allein reicht nicht: die statische File-Trace-Analyse von
  // Next.js erkennt chromium.executablePath()'s Zugriff auf die .br-Dateien nicht
  // (dynamisch konstruierter Pfad), daher fehlen sie sonst im deployten Funktions-
  // Bundle. Explizit für jede PDF-Route einschließen.
  outputFileTracingIncludes: {
    '/api/rechnung/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/kostenvoranschlag/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/pdf/generate': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/werkstattauftrag/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
}

export default withPWA(nextConfig)
