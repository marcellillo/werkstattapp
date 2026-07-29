import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function KostenvoranschlaegePage() {
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

  const { data: kostenvoranschlaege } = await supabase
    .from('kostenvoranschlaege')
    .select('*')
    .eq('betrieb_id', betriebId)
    .order('created_at', { ascending: false })

  return (
    <AppLayout title="Kostenvoranschläge">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">📋 Kostenvoranschläge</h1>
            <p className="text-slate-600 mt-1">Verwalte deine Angebote</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Neuer Voranschlag
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Übersicht</CardTitle>
          </CardHeader>
          <CardContent>
            {!kostenvoranschlaege?.length ? (
              <p className="text-slate-500 text-center py-8">Keine Kostenvoranschläge vorhanden</p>
            ) : (
              <div className="space-y-3">
                {kostenvoranschlaege.map(kv => (
                  <div key={kv.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium">{kv.nummer}</p>
                      <p className="text-sm text-slate-600">{kv.typ === 'werkstatt' ? '🔧 Werkstatt' : '🚗 Verkauf'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{kv.summe?.toFixed(2)} €</p>
                      <p className="text-xs text-slate-500">{kv.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
