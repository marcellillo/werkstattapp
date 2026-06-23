'use client'
import { useState, useEffect } from 'react'

export function useBenachrichtigungenAnzahl() {
  const [anzahl, setAnzahl] = useState(0)

  async function laden() {
    try {
      const res = await fetch('/api/benachrichtigungen/anzahl')
      if (res.ok) {
        const data = await res.json()
        setAnzahl(data.anzahl ?? 0)
      }
    } catch {}
  }

  useEffect(() => {
    laden()
    const interval = setInterval(laden, 60_000) // jede Minute
    return () => clearInterval(interval)
  }, [])

  return anzahl
}
