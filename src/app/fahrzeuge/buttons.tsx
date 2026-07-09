'use client'
import Link from 'next/link'

export function VerkauftButtons({ eigenBereitsVerkauft, eigenVerkauft }: any) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 px-3 bg-green-100 rounded-xl border-4 border-green-600 mt-2 mb-4">
      <Link href="/fahrzeuge/verkauft">
        <button className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 px-6 py-5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl font-bold text-lg border-2 border-green-700">
          <span className="text-4xl">💰</span>
          <div className="text-center sm:text-left">
            <div className="font-bold text-lg">Verkaufte Fahrzeuge</div>
            <div className="text-sm opacity-90">{eigenBereitsVerkauft} Fahrzeuge</div>
          </div>
        </button>
      </Link>
      <Link href="/fahrzeuge/uebergeben">
        <button className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 px-6 py-5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-bold text-lg border-2 border-emerald-700">
          <span className="text-4xl">✅</span>
          <div className="text-center sm:text-left">
            <div className="font-bold text-lg">Übergeben</div>
            <div className="text-sm opacity-90">{eigenVerkauft} Fahrzeuge</div>
          </div>
        </button>
      </Link>
    </div>
  )
}
