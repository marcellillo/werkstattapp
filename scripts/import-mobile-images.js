const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importImages() {
  const jsonDir = 'C:\\Users\\marce\\Downloads\\mobile_export';
  const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));

  console.log(`🖼️  Starting image import for ${files.length} vehicles...`);

  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const file of files) {
    try {
      const filePath = path.join(jsonDir, file);
      const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const bNummer = jsonData.internalNumber;
      const images = jsonData.images || [];

      if (!bNummer) {
        skipped++;
        continue;
      }

      // Extract image URLs
      const imageUrls = images.map(img => img.ref).filter(Boolean);

      if (imageUrls.length === 0) {
        skipped++;
        continue;
      }

      // Find vehicle by kennzeichen (B-Nummer) or mobile_de_id
      let vehicles, selectError;

      // Try kennzeichen first
      const result1 = await supabase
        .from('fahrzeuge')
        .select('id')
        .eq('kennzeichen', bNummer)
        .limit(1);

      if (result1.data && result1.data.length > 0) {
        vehicles = result1.data;
        selectError = null;
      } else {
        // Try mobile_de_id
        const result2 = await supabase
          .from('fahrzeuge')
          .select('id')
          .eq('mobile_de_id', bNummer)
          .limit(1);
        vehicles = result2.data;
        selectError = result2.error;
      }

      if (selectError || !vehicles || vehicles.length === 0) {
        errors.push(`${bNummer}: Vehicle not found`);
        skipped++;
        continue;
      }

      const vehicleId = vehicles[0].id;
      const bilder_urls = JSON.stringify(imageUrls);

      // Update fahrzeug with images
      const { error: updateError } = await supabase
        .from('fahrzeuge')
        .update({ bilder_urls })
        .eq('id', vehicleId);

      if (updateError) {
        errors.push(`${bNummer}: ${updateError.message}`);
        skipped++;
      } else {
        updated++;
      }
    } catch (err) {
      errors.push(`${file}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n✅ Image import complete!`);
  console.log(`  Updated: ${updated} vehicles with images`);
  console.log(`  Skipped: ${skipped}`);
  if (errors.length > 0) {
    console.log(`  Errors (${errors.length}):`);
    errors.slice(0, 5).forEach(e => console.log(`    - ${e}`));
    if (errors.length > 5) console.log(`    ... and ${errors.length - 5} more`);
  }
}

importImages().catch(console.error);
