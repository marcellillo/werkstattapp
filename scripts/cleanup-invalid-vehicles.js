const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wjglxskeqfzwonugsquo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZ2x4c2tlcWZ6d29udWdzcXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjE4MjYsImV4cCI6MjA5NzQzNzgyNn0.8VLT2DjrDaZn_KhXC9WDtO2hKQSmkj17noqlV3GLfFk';

const supabase = createClient(supabaseUrl, supabaseKey);
const HELIOS_BETRIEB_ID = '1b500e76-081d-48c6-a17c-d777f4d6a4ab';
const jsonDir = 'C:\\Users\\marce\\Downloads\\mobile_export';

async function cleanup() {
  console.log('🧹 Cleanup invalid vehicles (not in Mobile.de JSONs)...\n');

  try {
    // 1. Extract valid B-numbers from JSON files
    const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
    const validBNumbers = new Set();

    for (const file of files) {
      try {
        const jsonData = JSON.parse(fs.readFileSync(path.join(jsonDir, file), 'utf8'));
        const bNummer = jsonData.internalNumber;
        if (bNummer) {
          validBNumbers.add(bNummer.toUpperCase());
        }
      } catch (e) {}
    }

    console.log(`📊 Valid B-numbers in JSONs: ${validBNumbers.size}`);
    console.log(`   Examples: ${Array.from(validBNumbers).slice(0, 5).join(', ')}\n`);

    // 2. Get all vehicles in Helios
    const { data: allVehicles } = await supabase
      .from('fahrzeuge')
      .select('id, kennzeichen')
      .eq('betrieb_id', HELIOS_BETRIEB_ID);

    console.log(`📊 Total vehicles in DB: ${allVehicles?.length || 0}\n`);

    // 3. Find vehicles NOT in JSON files
    const toDelete = [];
    for (const v of allVehicles || []) {
      if (!validBNumbers.has(v.kennzeichen?.toUpperCase())) {
        toDelete.push(v);
        console.log(`   ❌ ${v.kennzeichen} - NOT in Mobile.de`);
      }
    }

    console.log(`\n📊 Vehicles to delete: ${toDelete.length}\n`);

    if (toDelete.length === 0) {
      console.log('✅ All vehicles are valid!');
      return;
    }

    // 4. Delete invalid vehicles
    const idsToDelete = toDelete.map(v => v.id);
    console.log(`⏳ Deleting ${idsToDelete.length} invalid vehicles...`);

    const { error } = await supabase
      .from('fahrzeuge')
      .delete()
      .in('id', idsToDelete);

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    // 5. Final count
    const { count } = await supabase
      .from('fahrzeuge')
      .select('*', { count: 'exact', head: true })
      .eq('betrieb_id', HELIOS_BETRIEB_ID);

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Valid JSONs: ${validBNumbers.size}`);
    console.log(`   Before: ${allVehicles.length}`);
    console.log(`   After: ${count}`);
    console.log(`   Deleted: ${idsToDelete.length}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

cleanup().catch(console.error);
