const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkVehicles() {
  console.log('🔍 Checking fahrzeuge table...');

  // Get all eigen fahrzeuge
  const { data: vehicles, error } = await supabase
    .from('fahrzeuge')
    .select('id, kennzeichen, mobile_de_id, marke, modell, fahrzeug_typ, betrieb_id')
    .eq('fahrzeug_typ', 'eigen')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`\n✅ Found ${vehicles.length} vehicles:`);
  vehicles.forEach(v => {
    console.log(`  - ID: ${v.id}`);
    console.log(`    kennzeichen: "${v.kennzeichen}"`);
    console.log(`    mobile_de_id: "${v.mobile_de_id}"`);
    console.log(`    marke: "${v.marke}"`);
    console.log(`    betrieb_id: "${v.betrieb_id}"`);
    console.log('');
  });

  // Check if B-28 specific
  console.log('🔎 Searching for B-28 specifically...');
  const { data: b28, error: err2 } = await supabase
    .from('fahrzeuge')
    .select('*')
    .or('kennzeichen.eq.B-28,mobile_de_id.eq.B-28')
    .limit(1);

  if (err2) {
    console.error('Error:', err2);
  } else {
    console.log(`  Found: ${b28.length} vehicles`);
    if (b28.length > 0) {
      console.log(`  Columns: ${Object.keys(b28[0]).join(', ')}`);
    }
  }
}

checkVehicles().catch(console.error);
