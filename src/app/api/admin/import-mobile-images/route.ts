import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase env vars')
}

// Use service role (no RLS restrictions)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

export async function POST() {
  const jsonDir = 'C:\\Users\\marce\\Downloads\\mobile_export'
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  try {
    if (!fs.existsSync(jsonDir)) {
      return NextResponse.json({ error: `Directory not found: ${jsonDir}` }, { status: 400 })
    }

    const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'))
    console.log(`[Admin Image Import] Found ${files.length} JSON files`)

    for (const file of files) {
      try {
        const filePath = path.join(jsonDir, file)
        const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'))

        const bNummer = jsonData.internalNumber
        const images = jsonData.images || []

        if (!bNummer || images.length === 0) {
          skipped++
          continue
        }

        const imageUrls = images.map((img: any) => img.ref).filter(Boolean)
        if (imageUrls.length === 0) {
          skipped++
          continue
        }

        // Find ALL vehicles with this kennzeichen (no RLS)
        const { data: vehicles, error: queryError } = await supabase
          .from('fahrzeuge')
          .select('id, betrieb_id, kennzeichen')
          .eq('kennzeichen', bNummer)

        if (queryError) {
          console.error(`[Admin] Query error for ${bNummer}:`, queryError)
          errors.push(`${bNummer}: Query failed`)
          skipped++
          continue
        }

        if (!vehicles || vehicles.length === 0) {
          console.log(`[Admin] Vehicle ${bNummer} not found`)
          errors.push(`${bNummer}: Not found`)
          skipped++
          continue
        }

        const vehicle = vehicles[0]
        const bilder_urls = JSON.stringify(imageUrls)

        console.log(`[Admin] Updating ${bNummer} (ID: ${vehicle.id}) with ${imageUrls.length} images`)

        // Update without RLS restrictions
        const { error: updateError } = await supabase
          .from('fahrzeuge')
          .update({ bilder_urls })
          .eq('id', vehicle.id)

        if (updateError) {
          console.error(`[Admin] Update error for ${bNummer}:`, updateError)
          errors.push(`${bNummer}: ${updateError.message}`)
          skipped++
        } else {
          updated++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[Admin] Error processing ${file}:`, msg)
        errors.push(`${file}: ${msg}`)
        skipped++
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Admin] Critical error:`, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  console.log(`[Admin Image Import] Complete: ${updated} updated, ${skipped} skipped, ${errors.length} errors`)
  return NextResponse.json({ updated, skipped, errors: errors.slice(0, 10) })
}
