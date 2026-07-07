import { redirect } from 'next/navigation'

export default function VerkauftPage() {
  // Redirect zur Hauptseite mit Verkauft-Tab
  redirect('/fahrzeuge?tab=eigen&eigenSubTab=verkauft')
}
