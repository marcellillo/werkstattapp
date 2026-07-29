import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function RechnungenPage() {
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

  const { data: rechnungen } = await supabase
    .from('rechnungen')
    .select('*')
    .eq('betrieb_id', betriebId)
    .order('created_at', { ascending: false })

  return (
    <AppLayout title="Rechnungen">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">📄 Rechnungen</h1>
            <p className="text-slate-600 mt-1">Verwalte deine Rechnungen</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Neue Rechnung
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>🔧 Werkstatt-Rechnungen</CardTitle>
            </CardHeader>
            <CardContent>
              {!rechnungen?.filter(r => r.typ === 'werkstatt').length ? (
                <p className="text-slate-500 text-center py-8">Keine Werkstatt-Rechnungen</p>
              ) : (
                <div className="space-y-3">
                  {rechnungen.filter(r => r.typ === 'werkstatt').map(rechnung => (
                    <div key={rechnung.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{rechnung.nummer}</p>
                        <p className="text-sm text-slate-600">{rechnung.status}</p>
                      </div>
                      <p className="font-semibold">{rechnung.summe?.toFixed(2)} €</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🚗 Verkaufs-Rechnungen</CardTitle>
            </CardHeader>
            <CardContent>
              {!rechnungen?.filter(r => r.typ === 'verkauf').length ? (
                <p className="text-slate-500 text-center py-8">Keine Verkaufs-Rechnungen</p>
              ) : (
                <div className="space-y-3">
                  {rechnungen.filter(r => r.typ === 'verkauf').map(rechnung => (
                    <div key={rechnung.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{rechnung.nummer}</p>
                        <p className="text-sm text-slate-600">{rechnung.status}</p>
                      </div>
                      <p className="font-semibold">{rechnung.summe?.toFixed(2)} €</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
