// EPC GiroCode (SEPA Credit Transfer QR) — ISO 20022 / EPC069-12
export function buildGiroCode({
  bic,
  name,
  iban,
  betrag,
  verwendungszweck,
}: {
  bic?: string
  name: string
  iban: string
  betrag?: number
  verwendungszweck?: string
}): string {
  const ibanClean = iban.replace(/\s+/g, '')
  const betragStr = betrag ? `EUR${betrag.toFixed(2)}` : ''
  return [
    'BCD',
    '002',
    '1',
    'SCT',
    bic ?? '',
    name,
    ibanClean,
    betragStr,
    '',
    verwendungszweck ?? '',
    '',
  ].join('\n')
}
