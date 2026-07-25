import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as fs from 'fs'
import * as path from 'path'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: userBetriebe } = await supabase
    .from('betrieb_users')
    .select('betrieb_id')
    .eq('profile_id', user.id)
    .order('is_primary', { ascending: false })
    .limit(1)
  if (!userBetriebe?.[0]?.betrieb_id) {
    return NextResponse.json({ error: 'Kein Betrieb zugeordnet' }, { status: 403 })
  }
  const betriebId = userBetriebe[0].betrieb_id

  const jsonDir = 'C:\\Users\\marce\\Downloads\\mobile_export'
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  try {
    const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'))
    console.log(`[Image Import] Found ${files.length} JSON files, betriebId=${betriebId}`)

    for (const file of files) {
      try {
        const filePath = path.join(jsonDir, file)
        const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'))

        const bNummer = jsonData.internalNumber
        const images = jsonData.images || []

        if (!bNummer) {
          skipped++
          continue
        }

        const imageUrls = images.map((img: any) => img.ref).filter(Boolean)

        // Find vehicle by kennzeichen or mobile_de_id
        const { data: vehicles, error: queryError } = await supabase
          .from('fahrzeuge')
          .select('id, kennzeichen')
          .eq('betrieb_id', betriebId)
          .eq('kennzeichen', bNummer)
          .limit(1)

        if (queryError) {
          console.error(`[Image Import] Query error for ${bNummer}:`, queryError)
          errors.push(`${bNummer}: ${queryError.message}`)
          skipped++
          continue
        }

        if (!vehicles || vehicles.length === 0) {
          console.log(`[Image Import] Vehicle ${bNummer} not found in betrieb ${betriebId}`)
          errors.push(`${bNummer}: Nicht gefunden`)
          skipped++
          continue
        }

        console.log(`[Image Import] Found ${bNummer} (ID: ${vehicles[0].id}), importing ${imageUrls.length} images`)

        const vehicleId = vehicles[0].id
        const bilder_urls = imageUrls.length > 0 ? JSON.stringify(imageUrls) : null

        const { error: updateError } = await supabase
          .from('fahrzeuge')
          .update({
            bilder_urls,
            kennzeichen: bNummer,
            mobile_de_id: bNummer
          })
          .eq('id', vehicleId)
          .eq('betrieb_id', betriebId)

        if (updateError) {
          errors.push(`${bNummer}: ${updateError.message}`)
          skipped++
        } else {
          updated++
        }
      } catch (err) {
        errors.push(`${file}: ${(err as Error).message}`)
        skipped++
      }
    }
  } catch (err) {
    return NextResponse.json({ error: `Directory error: ${(err as Error).message}` }, { status: 500 })
  }

  console.log(`[Image Import] Complete: ${updated} updated, ${skipped} skipped, ${errors.length} errors`)
  return NextResponse.json({ updated, skipped, errors: errors.slice(0, 10) })
}
