// CSV für deutsches Excel/DATEV-Import-Vorbereitung: Semikolon, Dezimalkomma, UTF-8 mit BOM, Datum TT.MM.JJJJ.

export type CsvWert = string | number | boolean | null | undefined

export function csvFeld(wert: CsvWert): string {
  if (wert === null || wert === undefined) return ''
  let s = typeof wert === 'number' ? deZahl(wert) : typeof wert === 'boolean' ? (wert ? 'ja' : 'nein') : String(wert)
  s = s.replace(/\r?\n/g, ' ')
  // Formel-Einschleusung in Excel verhindern (Text, der mit = + - @ beginnt, würde als Formel gelesen)
  if (/^[=+@]/.test(s) || (/^-/.test(s) && !/^-\d/.test(s))) s = "'" + s
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function csvDatei(kopf: string[], zeilen: CsvWert[][]): string {
  return '﻿' + [kopf, ...zeilen].map(z => z.map(csvFeld).join(';')).join('\r\n') + '\r\n'
}

/** 1234.5 -> "1234,50" (ohne Tausenderpunkt, damit Excel/DATEV die Zahl sicher erkennt) */
export function deZahl(n: number): string {
  return (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2).replace('.', ',')
}

/** "2026-10-09" oder ISO-Zeitstempel -> "09.10.2026" */
export function deDatum(wert: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(wert ?? '')
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}
