// Einheitlicher Verkaufsaufschlag auf den Einkaufspreis von Ersatzteilen.
// Bisher an drei Stellen unabhaengig als literale 1.45 hartkodiert
// (api/kostenvoranschlag/add-teile, teile-erfassung-tabs, rechnung-flow) --
// eine kuenftige Aenderung des Aufschlags haette leicht eine der drei Stellen
// uebersehen koennen und zu inkonsistent bepreisten Rechnungen gefuehrt.
export const ERSATZTEIL_AUFSCHLAG = 1.45

export function mitAufschlag(einkaufspreis: number): number {
  return einkaufspreis * ERSATZTEIL_AUFSCHLAG
}
