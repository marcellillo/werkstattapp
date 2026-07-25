const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wjglxskeqfzwonugsquo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZ2x4c2tlcWZ6d29udWdzcXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjE4MjYsImV4cCI6MjA5NzQzNzgyNn0.8VLT2DjrDaZn_KhXC9WDtO2hKQSmkj17noqlV3GLfFk';

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function createHeliosAndImport() {
  console.log('🚀 Creating Helios Automobile GmbH and importing Mobile.de vehicles...\n');

  try {
    // Step 1: Create betrieb "Helios Automobile GmbH"
    console.log('📍 Step 1: Creating betrieb...');
    const { data: newBetrieb, error: betriebError } = await supabase
      .from('betriebe')
      .insert({ name: 'Helios Automobile GmbH' })
      .select()
      .single();

    if (betriebError || !newBetrieb) {
      console.error('❌ Failed to create betrieb:', betriebError?.message);
      return;
    }

    const betriebId = newBetrieb.id;
    console.log(`✅ Betrieb created with ID: ${betriebId}\n`);

    // Step 2: Get current user and assign to betrieb
    console.log('📍 Step 2: Getting current user...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('⚠️  No authenticated user, skipping user assignment');
    } else {
      console.log(`📍 Assigning user ${user.id} to betrieb...`);
      await supabase.from('betrieb_users').insert({
        betrieb_id: betriebId,
        profile_id: user.id,
        role: 'admin',
        is_primary: true,
      });
      console.log('✅ User assigned\n');
    }

    // Step 3: Import Mobile.de vehicles
    console.log('📍 Step 3: Importing Mobile.de vehicles...\n');

    const jsonDir = 'C:\\Users\\marce\\Downloads\\mobile_export';
    let inserted = 0;
    let skipped = 0;
    const errors = [];

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
        const vin = jsonData.vin || null;

        // Insert vehicle
        const { data: fahrzeug, error: insertError } = await supabase
          .from('fahrzeuge')
          .insert({
            betrieb_id: betriebId,
            fahrzeug_typ: 'eigen',
            kennzeichen: bNummer,
            fahrgestellnummer: vin,
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
          })
          .select()
          .single();

        if (insertError || !fahrzeug) {
          errors.push(`${bNummer}: ${insertError?.message}`);
          skipped++;
          continue;
        }

        // Create auftrag
        const finSuffix = vin ? vin.slice(-6).toUpperCase() : bNummer.slice(-3);
        await supabase.from('auftraege').insert({
          betrieb_id: betriebId,
          auftrag_nr: `AU-${finSuffix}`,
          fahrzeug_id: fahrzeug.id,
          kunden_id: null,
          status: 'angenommen',
        });

        console.log(`✅ ${bNummer}: ${makeCap} ${model} (${bilder.length} images)`);
        inserted++;
      } catch (err) {
        errors.push(`${file}: ${err.message}`);
        skipped++;
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Betrieb ID: ${betriebId}`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log(`\n   Errors:`);
      errors.slice(0, 5).forEach(e => console.log(`   - ${e}`));
    }
  } catch (err) {
    console.error('❌ Critical error:', err.message);
  }
}

createHeliosAndImport().catch(console.error);
