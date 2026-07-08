import { redirect } from 'next/navigation'

export default function UebergebenPage() {
  // Redirect zur Verkauft-Seite (alle Fahrzeuge dort)
  redirect('/fahrzeuge/verkauft')
}
