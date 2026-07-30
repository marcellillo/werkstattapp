import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, ChevronRight } from 'lucide-react'

export default async function WerkstattaufraetagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userBetriebe } = await supabase
    .from('betrieb_users')
    .select('betrieb_id')
    .eq('profile_id', user.id)
    .order('is_primary', { ascending: false })
    .limit(1)

  if (!userBetriebe?.[0]?.betrieb_id) redirect('/login')
  const betriebId = userBetriebe[0].betrieb_id

  const { data: auftraege } = await supabase
    .from('auftraege')
    .select('*, fahrzeug:fahrzeuge(marke, modell, kennzeichen), kunde:kunden(vorname, nachname)')
    .eq('betrieb_id', betriebId)
    .not('status', 'in', '("ausgeliefert","storniert")')
    .order('erstellt_am', { ascending: false })

  return (
    <AppLayout title="Werkstattaufträge">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">🔧 Werkstattaufträge</h1>
            <p className="text-slate-600 mt-1">Verwalte deine Reparaturaufträge</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Neuer Auftrag
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Übersicht</CardTitle>
          </CardHeader>
          <CardContent>
            {!auftraege?.length ? (
              <p className="text-slate-500 text-center py-8">Keine Aufträge vorhanden</p>
            ) : (
              <div className="space-y-3">
                {auftraege.map(auftrag => (
                  <Link key={auftrag.id} href={`/fahrzeuge/${auftrag.id}`}>
                    <div className="flex items-center justify-between p-3 bg-slate-50 hover:bg-blue-50 rounded-lg cursor-pointer transition border border-slate-200 hover:border-blue-300">
                      <div>
                        <p className="font-medium">
                          {(auftrag.fahrzeug as any)?.marke} {(auftrag.fahrzeug as any)?.modell}
                        </p>
                        <p className="text-sm text-slate-600">
                          {(auftrag.kunde as any)?.vorname} {(auftrag.kunde as any)?.nachname} • Status: {auftrag.status}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
