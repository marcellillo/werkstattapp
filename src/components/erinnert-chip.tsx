// Kleiner Hinweis "Erinnert vor 3 Tagen (WhatsApp, 2×)" aus dem Erinnerungsprotokoll
import { vorTagen } from '@/lib/zahlung'

export const KANAL_NAME: Record<string, string> = { whatsapp: 'WhatsApp', email: 'E-Mail', telefon: 'Telefon', sms: 'SMS' }

export function ErinnertChip({ eintrag }: { eintrag?: { anzahl: number; letzte: string; kanal: string } | null }) {
  if (!eintrag) return null
  return (
    <span className="text-xs text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
      Erinnert {vorTagen(eintrag.letzte)} ({KANAL_NAME[eintrag.kanal] ?? eintrag.kanal}{eintrag.anzahl > 1 ? `, ${eintrag.anzahl}×` : ''})
    </span>
  )
}
