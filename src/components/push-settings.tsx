'use client'
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'
import { usePush } from '@/hooks/use-push'

export function PushSettings() {
  const { status, error, subscribe, unsubscribe } = usePush()

  if (status === 'unsupported') {
    return (
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <BellOff className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-700">Push-Benachrichtigungen</p>
          <p className="text-xs text-gray-500 mt-0.5">Wird von diesem Browser nicht unterstützt</p>
        </div>
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
        <BellOff className="w-5 h-5 text-red-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-700">Push-Benachrichtigungen blockiert</p>
          <p className="text-xs text-red-600 mt-0.5">In den Browser-Einstellungen erlauben und Seite neu laden</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
      <div className="flex items-center gap-3">
        {status === 'subscribed'
          ? <BellRing className="w-5 h-5 text-orange-500 flex-shrink-0" />
          : <Bell className="w-5 h-5 text-gray-400 flex-shrink-0" />
        }
        <div>
          <p className="text-sm font-medium text-gray-900">Push-Benachrichtigungen</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {status === 'subscribed'
              ? 'Aktiv — du wirst bei wichtigen Ereignissen benachrichtigt'
              : 'Deaktiviert — keine Benachrichtigungen'
            }
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-1 col-span-2">{error}</p>
      )}
      {status === 'loading' ? (
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      ) : status === 'subscribed' ? (
        <button
          onClick={unsubscribe}
          className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          Deaktivieren
        </button>
      ) : (
        <button
          onClick={subscribe}
          className="px-3 py-1.5 text-xs font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
        >
          Aktivieren
        </button>
      )}
    </div>
  )
}
