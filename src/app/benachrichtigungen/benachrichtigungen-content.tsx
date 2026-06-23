'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Bell, RefreshCw, AlertTriangle, Info, Package, Clock, ShieldAlert, CheckCircle2, CheckCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatDateTime } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const TYP_CONFIG: Record<string, { icon: React.ElementType; farbe: string; label: string }> = {
  info:                 { icon: Info,         farbe: 'text-blue-500',   label: 'Info' },
  warnung:              { icon: AlertTriangle, farbe: 'text-orange-500', label: 'Warnung' },
  fehler:               { icon: AlertTriangle, farbe: 'text-red-500',    label: 'Fehler' },
  teil_eingetroffen:    { icon: Package,       farbe: 'text-green-500',  label: 'Teil eingetroffen' },
  termin_ueberschritten:{ icon: Clock,         farbe: 'text-red-500',    label: 'Überfällig' },
  zu_lange_auf_buehne:  { icon: ShieldAlert,   farbe: 'text-orange-500', label: 'Hebebühne' },
}

const KATEGORIEN = [
  { key: 'alle',                  label: 'Alle' },
  { key: 'termin_ueberschritten', label: 'Überfällig' },
  { key: 'warnung',               label: 'Warnungen' },
  { key: 'zu_lange_auf_buehne',   label: 'Hebebühne' },
  { key: 'teil_eingetroffen',     label: 'Teile' },
  { key: 'info',                  label: 'Termine' },
]

interface Props {
  notifications: any[]
  unreadCount: number
}

export function BenachrichtigungenContent({ notifications, unreadCount }: Props) {
  const [liste, setListe] = useState(notifications)
  const [kategorie, setKategorie] = useState('alle')
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()

  async function alsGelesenMarkieren(id: string) {
    await supabase.from('benachrichtigungen').update({ gelesen: true }).eq('id', id)
    setListe(l => l.map(n => n.id === id ? { ...n, gelesen: true } : n))
  }

  async function alleAlsGelesenMarkieren() {
    await supabase.from('benachrichtigungen').update({ gelesen: true }).eq('gelesen', false)
    setListe(l => l.map(n => ({ ...n, gelesen: true })))
  }


  const filtered = liste.filter(n =>
    kategorie === 'alle' || n.typ === kategorie
  )

  const sortiert = [...filtered].sort((a, b) => {
    const prio = (n: any) =>
      n.typ === 'termin_ueberschritten' ? 0 :
      n.typ === 'warnung' ? 1 :
      n.typ === 'zu_lange_auf_buehne' ? 2 :
      n.typ === 'fehler' ? 3 :
      n.typ === 'teil_eingetroffen' ? 4 : 5
    const p = prio(a) - prio(b)
    if (p !== 0) return p
    return new Date(b.erstellt_am).getTime() - new Date(a.erstellt_am).getTime()
  })

  async function aktualisieren() {
    setRefreshing(true)
    try {
      await fetch('/api/benachrichtigungen/generieren', { method: 'POST' })
      window.location.reload()
    } finally {
      setRefreshing(false)
    }
  }

  const ungelesen = liste.filter(n => !n.gelesen).length
  const zaehler: Record<string, number> = { alle: liste.length }
  for (const n of liste) zaehler[n.typ] = (zaehler[n.typ] ?? 0) + 1

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Benachrichtigungen</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {ungelesen > 0 ? `${ungelesen} neu` : 'Alle gelesen'}
            {' · '}
            {liste.length} gesamt
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ungelesen > 0 && (
            <Button variant="outline" size="sm" onClick={alleAlsGelesenMarkieren} className="gap-2">
              <CheckCheck className="w-4 h-4" /> Alle gelesen
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={aktualisieren} disabled={refreshing} className="gap-2">
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Kategorien-Filter */}
      <div className="flex flex-wrap gap-2">
        {KATEGORIEN.map(k => {
          const count = zaehler[k.key] ?? 0
          return (
            <button
              key={k.key}
              onClick={() => setKategorie(k.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                kategorie === k.key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              )}
            >
              {k.label}
              {count > 0 && (
                <span className={cn(
                  'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]',
                  kategorie === k.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Liste */}
      {sortiert.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <p className="font-medium text-gray-900">Alles in Ordnung</p>
          <p className="text-sm text-gray-500 mt-1">Keine Benachrichtigungen in dieser Kategorie</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortiert.map((n: any) => {
            const cfg = TYP_CONFIG[n.typ] ?? { icon: Bell, farbe: 'text-gray-500', label: n.typ }
            const Icon = cfg.icon
            const istKritisch = n.typ === 'termin_ueberschritten' || n.typ === 'fehler'
            return (
              <Card
                key={n.id}
                onClick={() => !n.gelesen && alsGelesenMarkieren(n.id)}
                className={cn(
                  'transition-all',
                  !n.gelesen && istKritisch ? 'border-red-200 bg-red-50/30 cursor-pointer hover:shadow-md' :
                  !n.gelesen ? 'border-orange-200 bg-orange-50/20 cursor-pointer hover:shadow-md' :
                  'opacity-60'
                )}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                      istKritisch ? 'bg-red-100' : n.typ === 'warnung' || n.typ === 'zu_lange_auf_buehne' ? 'bg-orange-100' : 'bg-blue-100'
                    )}>
                      <Icon className={cn('w-4 h-4', cfg.farbe)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-gray-900 leading-tight">{n.titel}</p>
                        {!n.gelesen && (
                          <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5 leading-snug">{n.nachricht}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={cn('text-[10px] font-semibold uppercase tracking-wide', cfg.farbe)}>
                          {cfg.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{formatDateTime(n.erstellt_am)}</span>
                          {n.auftrag_id && (
                            <Link href={`/fahrzeuge/${n.auftrag_id}`} className="text-xs text-orange-600 hover:underline font-medium">
                              Zum Auftrag →
                            </Link>
                          )}
                          {!n.gelesen && (
                            <span className="text-[10px] text-gray-400 italic">Antippen zum Lesen</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
