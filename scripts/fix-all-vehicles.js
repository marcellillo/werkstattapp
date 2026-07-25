const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wjglxskeqfzwonugsquo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZ2x4c2tlcWZ6d29udWdzcXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjE4MjYsImV4cCI6MjA5NzQzNzgyNn0.8VLT2DjrDaZn_KhXC9WDtO2hKQSmkj17noqlV3GLfFk';

const supabase = createClient(supabaseUrl, supabaseKey);

// Mappings
const FARBE = {
  BLACK: 'Schwarz', WHITE: 'Weiß', SILVER: 'Silber', GREY: 'Grau', GRAY: 'Grau',
  BLUE: 'Blau', RED: 'Rot', GREEN: 'Grün', YELLOW: 'Gelb', ORANGE: 'Orange',
  BROWN: 'Braun', GOLD: 'Gold', VIOLET: 'Violett', BEIGE: 'Beige', BRONZE: 'Bronze',
  PURPLE: 'Lila', PINK: 'Pink',
};

const KRAFTSTOFF = {
  DIESEL: 'Diesel', PETROL: 'Benzin', ELECTRIC: 'Elektro',
  HYBRID_DIESEL: 'Hybrid (Diesel)', HYBRID_PETROL: 'Hybrid (Benzin)', HYBRID: 'Hybrid',
  NATURAL_GAS: 'Erdgas (CNG)', CNG: 'CNG', LPG: 'Flüssiggas (LPG)', HYDROGEN: 'Wasserstoff',
};

async function fixAllVehicles() {
  const jsonDir = 'C:\\Users\\marce\\Downloads\\mobile_export';
  let updated = 0;
  let skipped = 0;
  const errors = [];

  console.log('🔧 Starting vehicle fix...\n');

  try {
    const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
    console.log(`📊 Found ${files.length} JSON files\n`);

    for (const file of files) {
      try {
        const filePath = path.join(jsonDir, file);
        const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const bNummer = jsonData.internalNumber;
        if (!bNummer) {
          skipped++;
          continue;
        }

        const make = (jsonData.make || '').replace(/-/g, ' ');
        const makeCap = make ? make.charAt(0) + make.slice(1).toLowerCase() : '';
        const model = jsonData.modelDescription || jsonData.model || '';

        if (!model) {
          skipped++;
          continue;
        }

        const baujahr = jsonData.firstRegistration ? parseInt(String(jsonData.firstRegistration).slice(0, 4)) : null;
        const preis = jsonData.price?.consumerPriceGross ? parseFloat(jsonData.price.consumerPriceGross) : null;
        const bilder = (jsonData.images ?? []).map((img) => img.ref).filter(Boolean);
        const farbe = FARBE[jsonData.exteriorColor] || jsonData.exteriorColor || null;
        const kraftstoff = KRAFTSTOFF[jsonData.fuel] || jsonData.fuel || null;

        const updateData = {
          kennzeichen: bNummer,
          mobile_de_id: bNummer,
          marke: makeCap,
          modell: model,
          baujahr,
          kilometerstand: jsonData.mileage || null,
          farbe,
          motortyp: kraftstoff,
          hubraum: jsonData.cubicCapacity ? String(jsonData.cubicCapacity) : null,
          leistung_kw: jsonData.power || null,
          verkaufspreis: preis,
          bilder_urls: bilder.length > 0 ? JSON.stringify(bilder) : null,
          notizen: preis ? `Verkaufspreis: ${preis.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : null,
        };

        // Find vehicle by ANY of these conditions and update
        const { data: vehicles, error: findError } = await supabase
          .from('fahrzeuge')
          .select('id, marke, modell')
          .or(`kennzeichen.eq.${bNummer},mobile_de_id.eq.${bNummer},marke.eq.${makeCap.replace("'", "\\'")}`)
          .limit(1);

        if (findError) {
          console.error(`❌ ${bNummer}: Find error`, findError.message);
          errors.push(`${bNummer}: Find failed`);
          skipped++;
          continue;
        }

        if (!vehicles || vehicles.length === 0) {
          console.log(`⏭️  ${bNummer}: Not found`);
          skipped++;
          continue;
        }

        const vehicleId = vehicles[0].id;
        const { error: updateError } = await supabase
          .from('fahrzeuge')
          .update(updateData)
          .eq('id', vehicleId);

        if (updateError) {
          console.error(`❌ ${bNummer}: Update failed`, updateError.message);
          errors.push(`${bNummer}: ${updateError.message}`);
          skipped++;
        } else {
          console.log(`✅ ${bNummer}: Updated (ID: ${vehicleId})`);
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

  console.log(`\n✅ Fix complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log(`\n   First 5 errors:`);
    errors.slice(0, 5).forEach(e => console.log(`   - ${e}`));
  }
}

fixAllVehicles().catch(console.error);
