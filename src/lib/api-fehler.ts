// Einheitliche Fehlerantwort für unerwartete Serverfehler: Details (Datenbank-/Bibliotheksmeldungen mit
// Tabellen-, Spalten- oder Pfadnamen) gehen nur ins Server-Log, der Browser bekommt eine neutrale Meldung
// mit einer kurzen Referenz, unter der der Eintrag im Vercel-Log wiederzufinden ist.
import { NextResponse } from 'next/server'

export function serverFehler(fehler: unknown, kontext: string, status = 500) {
  const ref = Math.random().toString(36).slice(2, 8)
  const meldung = (fehler as any)?.message ?? String(fehler)
  console.error(`[${kontext}] Fehler (Ref ${ref}):`, meldung)
  return NextResponse.json(
    { error: `Es ist ein Fehler aufgetreten (Ref ${ref}). Bitte erneut versuchen – wenn es wieder passiert, bitte melden.` },
    { status },
  )
}
