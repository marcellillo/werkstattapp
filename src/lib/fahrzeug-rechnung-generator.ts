import { createClient } from '@/lib/supabase/server'
import { berechneFahrzeugSteuer } from './fahrzeug-steuer'

export interface FahrzeugRechnungDaten {
  auftragId: string
  fahrzeugId: string
  fahrzeugMarke: string
  fahrzeugModell: string
  fahrzeugBaujahr?: number
  fahrzeugFarbe?: string
  fahrzeugKm?: number
  fahrzeugFahrgestellnummer?: string
  verkaufspreis: number
  einkaufspreis?: number
  steuerart: 'differenz' | 'regel' | 'ausfuhr'
  kaeuferName?: string
  kaeuferEmail?: string
  verkauftAm: string
  bilderUrl?: string[]
}

/**
 * Erzeugt die nächste Rechnungsnummer für Fahrzeug-Rechnungen
 */
export async function getNextRechnungsnummer(): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fahrzeug_rechnungen')
    .select('rechnungsnummer')
    .order('rechnungsnummer', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) {
    // Starten bei 74 (falls keine Rechnungen existieren)
    return 74
  }

  return (data[0].rechnungsnummer ?? 73) + 1
}

/**
 * Erzeugt HTML für die Fahrzeug-Rechnung (für PDF-Rendering)
 */
export function generateFahrzeugRechnungHtml(
  daten: FahrzeugRechnungDaten,
  rechnungsnummer: number,
  firmaDaten: {
    name: string
    strasse?: string
    plz?: string
    ort?: string
    email?: string
    telefon?: string
    ustId?: string
    steuernummer?: string
  }
): string {
  const s = berechneFahrzeugSteuer({
    verkaufspreis: daten.verkaufspreis,
    einkaufspreis: daten.einkaufspreis,
    steuerart: daten.steuerart,
  })

  const hauptbild = daten.bilderUrl?.[0] ?? null
  const vkDatum = new Date(daten.verkauftAm).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const steuertxt =
    daten.steuerart === 'differenz'
      ? '§25a Differenzbesteuerung'
      : daten.steuerart === 'regel'
        ? 'Regelbesteuerung (19% MwSt)'
        : 'Ausfuhr (steuerfrei)'

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Rechnung ${rechnungsnummer}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #333;
      background: white;
      padding: 40px;
      line-height: 1.6;
    }
    .container { max-width: 900px; margin: 0 auto; }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #1e40af;
      padding-bottom: 30px;
      margin-bottom: 40px;
    }
    .firma-info h1 { font-size: 24px; font-weight: bold; color: #1e40af; margin-bottom: 8px; }
    .firma-info p { font-size: 12px; color: #666; margin: 2px 0; }
    .rechnung-info { text-align: right; }
    .rechnung-info h2 { font-size: 28px; font-weight: bold; color: #1e40af; margin-bottom: 8px; }
    .rechnung-info p { font-size: 12px; color: #666; margin: 2px 0; }

    /* Fahrzeug-Foto */
    .fahrzeug-foto {
      width: 100%;
      max-height: 300px;
      object-fit: cover;
      border-radius: 8px;
      margin-bottom: 30px;
    }

    /* Fahrzeug-Details */
    .fahrzeug-details {
      background: #f0f4f8;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .detail-row { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .detail-label { font-weight: 600; color: #1e40af; width: 140px; }
    .detail-value { color: #333; }

    /* Hauptpreis */
    .verkaufspreis-box {
      background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      text-align: center;
    }
    .verkaufspreis-label { font-size: 14px; opacity: 0.9; margin-bottom: 8px; }
    .verkaufspreis-betrag { font-size: 48px; font-weight: bold; }

    /* Steuern */
    .steuern-info {
      background: #fafafa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border-left: 4px solid #f59e0b;
    }
    .steuer-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .steuer-row:last-child { border-bottom: none; }
    .steuer-label { font-weight: 500; }
    .steuer-betrag { text-align: right; min-width: 120px; }
    .steuer-typ { font-size: 12px; color: #666; font-style: italic; margin-bottom: 12px; }

    /* Käufer-Daten */
    .kaeufer-info {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .kaeufer-info h3 { font-size: 14px; font-weight: bold; color: #1e40af; margin-bottom: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    .kaeufer-daten { background: #f9fafb; padding: 15px; border-radius: 6px; font-size: 13px; }

    /* Unterschrift */
    .unterschrift-box {
      margin-top: 50px;
      padding-top: 30px;
      border-top: 1px solid #d1d5db;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
    }
    .unterschrift-feld { }
    .unterschrift-feld p { font-size: 12px; color: #666; margin-bottom: 40px; }
    .unterschrift-linie { border-top: 1px solid #333; margin-top: 8px; padding-top: 6px; font-size: 11px; text-align: center; color: #666; }

    /* Footer */
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #d1d5db;
      text-align: center;
      font-size: 11px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="firma-info">
        <h1>${firmaDaten.name}</h1>
        ${firmaDaten.strasse ? `<p>${firmaDaten.strasse}</p>` : ''}
        ${firmaDaten.plz && firmaDaten.ort ? `<p>${firmaDaten.plz} ${firmaDaten.ort}</p>` : ''}
        ${firmaDaten.telefon ? `<p>Tel: ${firmaDaten.telefon}</p>` : ''}
        ${firmaDaten.email ? `<p>E-Mail: ${firmaDaten.email}</p>` : ''}
      </div>
      <div class="rechnung-info">
        <h2>RECHNUNG</h2>
        <p><strong>Rechnungsnummer:</strong> ${rechnungsnummer}</p>
        <p><strong>Ausstellungsdatum:</strong> ${vkDatum}</p>
      </div>
    </div>

    <!-- Fahrzeug-Foto -->
    ${hauptbild ? `<img src="${hauptbild}" alt="Fahrzeug" class="fahrzeug-foto">` : ''}

    <!-- Fahrzeug-Details -->
    <div class="fahrzeug-details">
      <div>
        <div class="detail-row">
          <span class="detail-label">Fahrzeug:</span>
          <span class="detail-value">${daten.fahrzeugMarke} ${daten.fahrzeugModell}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Baujahr:</span>
          <span class="detail-value">${daten.fahrzeugBaujahr ?? '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Farbe:</span>
          <span class="detail-value">${daten.fahrzeugFarbe ?? '—'}</span>
        </div>
      </div>
      <div>
        <div class="detail-row">
          <span class="detail-label">Kilometer:</span>
          <span class="detail-value">${daten.fahrzeugKm?.toLocaleString('de-DE') ?? '—'} km</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Fahrgestellnummer:</span>
          <span class="detail-value">${daten.fahrzeugFahrgestellnummer ?? '—'}</span>
        </div>
      </div>
    </div>

    <!-- Verkaufspreis (prominent) -->
    <div class="verkaufspreis-box">
      <div class="verkaufspreis-label">VERKAUFSPREIS</div>
      <div class="verkaufspreis-betrag">${s.vk.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
    </div>

    <!-- Steuern & Berechnung (rechtlich korrekt) -->
    <div class="steuern-info">
      <div class="steuer-typ">${steuertxt}</div>
      <div class="steuer-row">
        <span class="steuer-label">Kaufpreis (Brutto):</span>
        <span class="steuer-betrag">${s.vk.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
      </div>
      <div class="steuer-row">
        <span class="steuer-label">davon Umsatzsteuer:</span>
        <span class="steuer-betrag">${s.mwst.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
      </div>
      <div class="steuer-row" style="font-weight: bold; background: #f0fdf4; padding: 12px 0; border: none;">
        <span class="steuer-label">Nettobetrag:</span>
        <span class="steuer-betrag">${s.netto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
      </div>
    </div>

    <!-- Käufer -->
    <div class="kaeufer-info">
      <h3>Käufer</h3>
      <div class="kaeufer-daten">
        <strong>${daten.kaeuferName ?? '________________'}</strong><br>
        ${daten.kaeuferEmail ?? ''}
      </div>
    </div>

    <!-- Unterschrift -->
    <div class="unterschrift-box">
      <div class="unterschrift-feld">
        <p>Ort und Datum</p>
        <div class="unterschrift-linie">_____________________</div>
      </div>
      <div class="unterschrift-feld">
        <p>Unterschrift Käufer/in</p>
        <div class="unterschrift-linie">_____________________</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin-bottom: 6px;">Dieses Dokument ist eine Fahrzeugverkaufs-Rechnung.</p>
      ${firmaDaten.ustId ? `<p>USt-ID: ${firmaDaten.ustId}</p>` : ''}
      ${firmaDaten.steuernummer ? `<p>Steuernummer: ${firmaDaten.steuernummer}</p>` : ''}
    </div>
  </div>
</body>
</html>
  `
}
