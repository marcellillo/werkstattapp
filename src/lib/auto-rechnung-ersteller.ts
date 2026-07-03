/**
 * Erstellt automatisch eine Fahrzeug-Rechnung wenn Status → 'ausgeliefert'
 */
export async function createRechnungOnAusgeliefert(auftragId: string): Promise<{
  success: boolean
  rechnungsnummer?: number
  error?: string
}> {
  try {
    const res = await fetch('/api/rechnungen/fahrzeug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auftragId }),
    })

    if (!res.ok) {
      const data = await res.json()
      return { success: false, error: data.error ?? 'Fehler beim Generieren' }
    }

    const data = await res.json()
    return {
      success: true,
      rechnungsnummer: data.rechnungsnummer,
    }
  } catch (error) {
    console.error('Fehler beim Erstellen der Rechnung:', error)
    return { success: false, error: 'Netzwerkfehler' }
  }
}
