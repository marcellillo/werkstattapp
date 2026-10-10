// Arbeitszeit: Dauer-Berechnung und Formatierung (gemeinsam für Auftrag, Startseite und Statistiken).

export const VERGESSEN_NACH_STUNDEN = 12     // eine Zeit, die länger läuft, gilt als "vergessen zu stoppen"
export const VERGESSEN_BEGRENZT_AUF_STUNDEN = 8

export interface Zeit { start_am: string; ende_am: string | null }

/** Dauer in Minuten; laufende Zeiten zählen bis jetzt, höchstens bis zur "Vergessen"-Grenze */
export function dauerMinuten(z: Zeit, jetzt: number = Date.now()): number {
  const start = Date.parse(z.start_am)
  const ende = z.ende_am ? Date.parse(z.ende_am) : Math.min(jetzt, start + VERGESSEN_NACH_STUNDEN * 3600_000)
  return Math.max(0, Math.round((ende - start) / 60_000))
}

export const istVergessen = (z: Zeit, jetzt: number = Date.now()) => !z.ende_am && jetzt - Date.parse(z.start_am) > VERGESSEN_NACH_STUNDEN * 3600_000

/** 95 -> "1 Std. 35 Min.", 40 -> "40 Min." */
export function dauerText(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h} Std.${m ? ` ${m} Min.` : ''}` : `${m} Min.`
}

/** 95 -> "1,58" (Stunden mit 2 Nachkommastellen, für Summen und Vergleich mit abgerechneten Stunden) */
export const stundenText = (min: number) => (min / 60).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })

/** Laufende Zeit als Uhr "01:23:45" */
export function uhrText(startIso: string, jetzt: number = Date.now()): string {
  const s = Math.max(0, Math.floor((jetzt - Date.parse(startIso)) / 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

/** Ende, mit dem eine laufende Zeit gestoppt wird: jetzt -- oder bei einer vergessenen Zeit die Begrenzung (mit Hinweis) */
export function stoppEnde(z: Zeit, jetzt: number = Date.now()): { ende: string; notiz: string | null } {
  if (!istVergessen(z, jetzt)) return { ende: new Date(jetzt).toISOString(), notiz: null }
  return {
    ende: new Date(Date.parse(z.start_am) + VERGESSEN_BEGRENZT_AUF_STUNDEN * 3600_000).toISOString(),
    notiz: `Lief über ${VERGESSEN_NACH_STUNDEN} Std. (vergessen zu stoppen) – auf ${VERGESSEN_BEGRENZT_AUF_STUNDEN} Std. begrenzt, bitte prüfen`,
  }
}
