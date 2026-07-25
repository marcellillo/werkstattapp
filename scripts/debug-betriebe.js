const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wjglxskeqfzwonugsquo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZ2x4c2tlcWZ6d29udWdzcXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjE4MjYsImV4cCI6MjA5NzQzNzgyNn0.8VLT2DjrDaZn_KhXC9WDtO2hKQSmkj17noqlV3GLfFk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log('📋 Debugging betriebe & fahrzeuge...\n');

  // Get all betriebe
  const { data: betriebe } = await supabase
    .from('betriebe')
    .select('id, name');

  console.log('📍 All betriebe:');
  if (betriebe?.length) {
    for (const b of betriebe) {
      const { count } = await supabase
        .from('fahrzeuge')
        .select('*', { count: 'exact', head: true })
        .eq('betrieb_id', b.id);

      console.log(`  - ${b.name} (${b.id})`);
      console.log(`    ├─ Fahrzeuge: ${count}`);

      // Show last 3
      const { data: latest } = await supabase
        .from('fahrzeuge')
        .select('id, kennzeichen, marke, modell, bilder_urls')
        .eq('betrieb_id', b.id)
        .limit(3);

      if (latest?.length) {
        for (const f of latest) {
          const hasImages = f.bilder_urls ? '✅' : '❌';
          console.log(`    └─ ${f.kennzeichen || '?'} - ${f.marke} ${f.modell} ${hasImages}`);
        }
      }
      console.log('');
    }
  } else {
    console.log('  ❌ No betriebe found!');
  }
}

debug().catch(console.error);
