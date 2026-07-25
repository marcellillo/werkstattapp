const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wjglxskeqfzwonugsquo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZ2x4c2tlcWZ6d29udWdzcXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjE4MjYsImV4cCI6MjA5NzQzNzgyNn0.8VLT2DjrDaZn_KhXC9WDtO2hKQSmkj17noqlV3GLfFk';

const supabase = createClient(supabaseUrl, supabaseKey);
const HELIOS_BETRIEB_ID = '1b500e76-081d-48c6-a17c-d777f4d6a4ab';

async function importHeliosImages() {
  console.log('🖼️ Importing images for Helios vehicles from JSON files...\n');

  const jsonDir = 'C:\\Users\\marce\\Downloads\\mobile_export';
  let updated = 0;
  let skipped = 0;
  const errors = [];

  try {
    // Get all Helios fahrzeuge
    const { data: fahrzeuge } = await supabase
      .from('fahrzeuge')
      .select('id, kennzeichen, mobile_de_id')
      .eq('betrieb_id', HELIOS_BETRIEB_ID);

    if (!fahrzeuge?.length) {
      console.log('❌ No vehicles found in Helios betrieb!');
      return;
    }

    console.log(`📍 Found ${fahrzeuge.length} vehicles in Helios\n`);

    // Build map by kennzeichen and mobile_de_id
    const vehicleMap = new Map();
    for (const v of fahrzeuge) {
      if (v.kennzeichen) vehicleMap.set(v.kennzeichen.toLowerCase(), v.id);
      if (v.mobile_de_id) vehicleMap.set(v.mobile_de_id.toLowerCase(), v.id);
    }

    // Read JSON files
    const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
    console.log(`📊 Found ${files.length} JSON files\n`);

    for (const file of files) {
      try {
        const filePath = path.join(jsonDir, file);
        const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const bNummer = jsonData.internalNumber;
        const images = (jsonData.images ?? []).map(img => img.ref).filter(Boolean);

        if (!bNummer || !images.length) {
          skipped++;
          continue;
        }

        // Find vehicle by B-Nummer
        const vehicleId = vehicleMap.get(bNummer.toLowerCase());
        if (!vehicleId) {
          console.log(`⏭️  ${bNummer}: Vehicle not found in Helios`);
          skipped++;
          continue;
        }

        // Update vehicle with images
        const { error } = await supabase
          .from('fahrzeuge')
          .update({ bilder_urls: JSON.stringify(images) })
          .eq('id', vehicleId)
          .eq('betrieb_id', HELIOS_BETRIEB_ID);

        if (error) {
          console.error(`❌ ${bNummer}: Update failed`, error.message);
          errors.push(`${bNummer}: ${error.message}`);
          skipped++;
        } else {
          console.log(`✅ ${bNummer}: ${images.length} images`);
          updated++;
        }
      } catch (err) {
        console.error(`❌ ${file}:`, err.message);
        errors.push(`${file}: ${err.message}`);
        skipped++;
      }
    }
  } catch (err) {
    console.error('❌ Critical error:', err.message);
    return;
  }

  console.log(`\n✅ Done!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log(`\n   Errors:`);
    errors.slice(0, 5).forEach(e => console.log(`   - ${e}`));
  }
}

importHeliosImages().catch(console.error);
