export async function printPDF(
  template: 'kostenvoranschlag' | 'werkstattauftrag' | 'rechnung',
  data: Record<string, any>,
  filename: string
) {
  try {
    const res = await fetch('/api/pdf/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, data }),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'PDF-Fehler')
    }

    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    return true
  } catch (error: any) {
    console.error('[PDF Print] Error:', error)
    throw error
  }
}

export function getCurrentDate(): string {
  return new Date().toLocaleDateString('de-DE')
}

export function getFutureDate(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE')
}
