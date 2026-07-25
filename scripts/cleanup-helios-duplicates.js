const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wjglxskeqfzwonugsquo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZ2x4c2tlcWZ6d29udWdzcXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjE4MjYsImV4cCI6MjA5NzQzNzgyNn0.8VLT2DjrDaZn_KhXC9WDtO2hKQSmkj17noqlV3GLfFk';

const supabase = createClient(supabaseUrl, supabaseKey);
const HELIOS_BETRIEB_ID = '1b500e76-081d-48c6-a17c-d777f4d6a4ab';

async function cleanup() {
  console.log('🧹 Cleaning up Helios duplicates...\n');

  try {
    // Get ALL fahrzeuge in Helios
    const { data: allVehicles } = await supabase
      .from('fahrzeuge')
      .select('id, kennzeichen, marke, modell, bilder_urls')
      .eq('betrieb_id', HELIOS_BETRIEB_ID);

    console.log(`📊 Total vehicles in Helios: ${allVehicles?.length || 0}\n`);

    // Group by kennzeichen
    const byKennzeichen = {};
    const noKennzeichen = [];

    for (const v of allVehicles || []) {
      if (v.kennzeichen) {
        if (!byKennzeichen[v.kennzeichen]) byKennzeichen[v.kennzeichen] = [];
        byKennzeichen[v.kennzeichen].push(v);
      } else {
        noKennzeichen.push(v);
      }
    }

    // Find duplicates
    const duplicates = [];
    for (const [kz, vehicles] of Object.entries(byKennzeichen)) {
      if (vehicles.length > 1) {
        console.log(`🔴 ${kz}: ${vehicles.length} duplicates`);
        // Keep the one with bilder_urls, delete others
        const withImages = vehicles.filter(v => v.bilder_urls);
        const toDelete = withImages.length > 0
          ? vehicles.filter(v => !v.bilder_urls)
          : vehicles.slice(1);
        duplicates.push(...toDelete);
      }
    }

    console.log(`\n❌ Vehicles without kennzeichen: ${noKennzeichen.length}`);
    console.log(`🔴 Duplicate vehicles found: ${duplicates.length}`);
    console.log(`📊 Total to delete: ${noKennzeichen.length + duplicates.length}\n`);

    // Delete all at once
    const idsToDelete = [...noKennzeichen, ...duplicates].map(v => v.id);

    if (idsToDelete.length === 0) {
      console.log('✅ No duplicates or orphans found!');
      return;
    }

    console.log(`⏳ Deleting ${idsToDelete.length} records...`);
    const { error } = await supabase
      .from('fahrzeuge')
      .delete()
      .in('id', idsToDelete);

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    // Check result
    const { count } = await supabase
      .from('fahrzeuge')
      .select('*', { count: 'exact', head: true })
      .eq('betrieb_id', HELIOS_BETRIEB_ID);

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Before: ${allVehicles.length}`);
    console.log(`   After: ${count}`);
    console.log(`   Deleted: ${idsToDelete.length}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

cleanup().catch(console.error);
