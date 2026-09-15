'use client'
import { useState, useEffect } from 'react'

interface DecimalFieldProps {
  value: number
  onChange: (n: number) => void
  placeholder?: string
  className?: string
}

/**
 * Zahlen-Eingabefeld, das sowohl Komma als auch Punkt als Dezimaltrennzeichen
 * akzeptiert. Natives <input type="number"> blockiert je nach Browser-Locale
 * eines der beiden Zeichen komplett - deshalb hier type="text" mit eigener
 * Normalisierung statt dessen.
 */
export function DecimalField({ value, onChange, placeholder, className }: DecimalFieldProps) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    const parsed = parseFloat(text.replace(',', '.'))
    // Nur von aussen synchronisieren (z.B. Formular-Reset), nicht während der Nutzer tippt
    if (parsed !== value) setText(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9,.\-]/g, '')
    setText(cleaned)
    const parsed = parseFloat(cleaned.replace(',', '.'))
    onChange(isNaN(parsed) ? 0 : parsed)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => setText(String(value))}
      placeholder={placeholder}
      className={className}
    />
  )
}
