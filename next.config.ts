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

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  // @sparticuz/chromium liefert vorkompilierte Binärdateien (.br) aus, die an ihrem
  // node_modules-Pfad liegen bleiben müssen -- der Bundler darf sie nicht anfassen/
  // verschieben, sonst findet chromium.executablePath() sie zur Laufzeit nicht mehr
  // ("input directory .../@sparticuz/chromium/bin does not exist").
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
}

export default withPWA(nextConfig)
