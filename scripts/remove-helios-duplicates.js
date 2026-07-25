const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wjglxskeqfzwonugsquo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZ2x4c2tlcWZ6d29udWdzcXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjE4MjYsImV4cCI6MjA5NzQzNzgyNn0.8VLT2DjrDaZn_KhXC9WDtO2hKQSmkj17noqlV3GLfFk';

const supabase = createClient(supabaseUrl, supabaseKey);
const HELIOS_BETRIEB_ID = '1b500e76-081d-48c6-a17c-d777f4d6a4ab';
const STANDARD_BETRIEB_ID = 'f63e19d9-b965-43c3-a475-b49a818d620b';

async function removeDuplicates() {
  console.log('🔍 Finding & removing duplicates...\n');

  try {
    // Get all fahrzeuge in BOTH betriebe
    const { data: standardVehicles } = await supabase
      .from('fahrzeuge')
      .select('id, kennzeichen, marke, modell')
      .eq('betrieb_id', STANDARD_BETRIEB_ID);

    const { data: heliosVehicles } = await supabase
      .from('fahrzeuge')
      .select('id, kennzeichen, marke, modell')
      .eq('betrieb_id', HELIOS_BETRIEB_ID);

    console.log(`📊 Standardwerkstatt: ${standardVehicles?.length || 0} Fahrzeuge`);
    console.log(`📊 Helios: ${heliosVehicles?.length || 0} Fahrzeuge\n`);

    if (!standardVehicles?.length) {
      console.log('✅ No vehicles in Standardwerkstatt to clean up');
      return;
    }

    // Find duplicates: same kennzeichen in both betriebe
    const standardKeys = new Set(
      standardVehicles
        .filter(v => v.kennzeichen)
        .map(v => v.kennzeichen.toLowerCase())
    );

    const duplicates = heliosVehicles?.filter(
      v => v.kennzeichen && standardKeys.has(v.kennzeichen.toLowerCase())
    ) || [];

    console.log(`🔴 Found ${duplicates.length} duplicates in Helios (same kennzeichen as Standardwerkstatt)\n`);

    if (duplicates.length === 0) {
      console.log('⚠️  No duplicates by kennzeichen.');
      console.log('   → The extra vehicles might be old legacy data without kennzeichen.');
      console.log('\nShould we delete ALL vehicles from Standardwerkstatt? (y/n)');
      return;
    }

    // Delete duplicates
    let deleted = 0;
    for (const dup of duplicates) {
      const { error } = await supabase
        .from('fahrzeuge')
        .delete()
        .eq('id', dup.id)
        .eq('betrieb_id', HELIOS_BETRIEB_ID);

      if (error) {
        console.error(`❌ ${dup.kennzeichen}: ${error.message}`);
      } else {
        console.log(`✅ Deleted duplicate: ${dup.kennzeichen} (${dup.marke} ${dup.modell})`);
        deleted++;
      }
    }

    console.log(`\n✅ Removed ${deleted} duplicates from Helios!`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

removeDuplicates().catch(console.error);
