import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Keine ID' }, { status: 400 })

  try {
    const url = `https://suchen.mobile.de/fahrzeuge/details.html?id=${id}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) return NextResponse.json({ error: 'Inserat nicht gefunden' }, { status: 404 })

    const html = await res.text()

    // Hilfsfunktion: ersten Treffer eines Regex aus HTML ziehen
    function extract(pattern: RegExp): string | null {
      const m = html.match(pattern)
      return m ? m[1].trim() : null
    }

    // Titel z.B. "VW Golf 1.6 TDI Comfortline"
    const titel = extract(/<h1[^>]*class="[^"]*headline[^"]*"[^>]*>([^<]+)</)
      ?? extract(/<title>([^|<]+)/)
      ?? null

    // Kilometerstand
    const kmRaw = extract(/(\d[\d.]+)\s*km/)
    const km = kmRaw ? parseInt(kmRaw.replace(/\./g, ''), 10) : null

    // Baujahr / EZ
    const bayJahrRaw = extract(/(?:EZ|Erstzulassung)[^\d]*(\d{2})\/(\d{4})/)
    const baujahr = bayJahrRaw ? null : (() => {
      const m2 = html.match(/(?:EZ|Erstzulassung)[^\d]*(\d{2})\/(\d{4})/)
      return m2 ? parseInt(m2[2], 10) : null
    })()

    // Farbe
    const farbe = extract(/(?:Außenfarbe|Farbe)[^>]*>[^<]*<[^>]+>([^<]{3,30})</)
      ?? extract(/(?:Farbe)["\s:]+([A-Za-zäöüÄÖÜ\s]{3,20})/)

    // Kraftstoff / Motor
    const kraftstoff = extract(/(?:Kraftstoff)[^>]*>[^<]*<[^>]+>([^<]{3,20})</)

    // Leistung
    const leistungRaw = extract(/(\d+)\s*kW/)
    const leistung_kw = leistungRaw ? parseInt(leistungRaw, 10) : null

    // Hubraum
    const hubraum = extract(/(\d[\d.]+)\s*(?:ccm|cm³)/)

    // Preis
    const preisRaw = extract(/(\d[\d.]+)\s*€/)
    const preis = preisRaw ? parseInt(preisRaw.replace(/\./g, ''), 10) : null

    return NextResponse.json({
      titel,
      km,
      baujahr,
      farbe,
      kraftstoff,
      leistung_kw,
      hubraum,
      preis,
      url,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
