'use client'
import { useEffect } from 'react'
import { usePageTitleContext } from '@/lib/page-title-context'

/**
 * Für Seiten mit dynamischem Titel (z.B. Fahrzeug-Detailseiten), die vom
 * statischen Pfad->Titel-Mapping im Layout nicht abgedeckt werden können.
 * Setzt den Titel beim Mounten, räumt ihn beim Verlassen der Seite wieder auf.
 */
export function SetTitle({ value }: { value: string }) {
  const { setTitle } = usePageTitleContext()
  useEffect(() => {
    setTitle(value)
    return () => setTitle(null)
  }, [value, setTitle])
  return null
}
