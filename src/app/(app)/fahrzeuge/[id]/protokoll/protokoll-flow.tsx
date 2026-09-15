'use client'
import { useState } from 'react'
import { FelderPruefen } from './felder-pruefen'
import { ProtokolllDruck } from './protokoll-druck'

export function ProtokolFlow({ auftrag, rechnungen }: { auftrag: any; rechnungen: any[] }) {
  const [schritt, setSchritt] = useState<'pruefen' | 'drucken'>('pruefen')
  const [aktualisiertesAuftrag, setAktualisiertesAuftrag] = useState(auftrag)

  if (schritt === 'pruefen') {
    return (
      <FelderPruefen
        auftrag={aktualisiertesAuftrag}
        onWeiter={updated => {
          setAktualisiertesAuftrag(updated)
          setSchritt('drucken')
        }}
      />
    )
  }

  return <ProtokolllDruck auftrag={aktualisiertesAuftrag} rechnungen={rechnungen} />
}
