const fs = require('fs');
const path = require('path');

const jsonDir = 'C:\\Users\\marce\\Downloads\\mobile_export';
const HELIOS_BETRIEB_ID = '1b500e76-081d-48c6-a17c-d777f4d6a4ab';

const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
const vehicles = [];

console.log('📋 Generating SQL INSERT for all vehicles...\n');

for (const file of files) {
  try {
    const jsonData = JSON.parse(fs.readFileSync(path.join(jsonDir, file), 'utf8'));

    const bNummer = jsonData.internalNumber;
    if (!bNummer) continue;

    const marke = (jsonData.marke || '').replace(/'/g, "''");
    const modell = (jsonData.modell || '').replace(/'/g, "''");
    const vin = (jsonData.vin || '').replace(/'/g, "''");
    const baujahr = jsonData.baujahr || null;
    const km = jsonData.km || 0;
    const farbe = (jsonData.farbe || '').replace(/'/g, "''");
    const kraftstoff = (jsonData.kraftstoff || '').replace(/'/g, "''");
    const preis = jsonData.preis || 0;
    const hubraum = jsonData.hubraum || null;
    const leistung = jsonData.leistung || null;

    // Images
    const images = (jsonData.images || []).map(img => img.ref).filter(Boolean);
    const bildUrlsJson = images.length > 0 ? JSON.stringify(images).replace(/'/g, "''") : null;

    vehicles.push({
      kennzeichen: bNummer,
      marke,
      modell,
      vin,
      baujahr,
      km,
      farbe,
      kraftstoff,
      preis,
      hubraum,
      leistung,
      bilder_urls: bildUrlsJson,
      mobile_de_id: bNummer
    });
  } catch (e) {
    console.error(`Error parsing ${file}: ${e.message}`);
  }
}

console.log(`Found ${vehicles.length} vehicles\n`);
console.log('-- Copy this entire SQL to Supabase Console → SQL Editor\n');

// Generate SQL
console.log(`-- DELETE old data first (if needed)
DELETE FROM fahrzeuge WHERE betrieb_id = '${HELIOS_BETRIEB_ID}'::uuid;

-- INSERT all vehicles with images
INSERT INTO fahrzeuge (
  betrieb_id, kennzeichen, marke, modell, vin, baujahr, km, farbe,
  kraftstoff, preis, hubraum, leistung, bilder_urls, mobile_de_id
) VALUES\n`);

const valueLines = vehicles.map((v, idx) => {
  const bilder = v.bilder_urls ? `'${v.bilder_urls}'` : 'NULL';
  const baujahr = v.baujahr ? v.baujahr : 'NULL';
  const hubraum = v.hubraum ? v.hubraum : 'NULL';
  const leistung = v.leistung ? v.leistung : 'NULL';

  return `  ('${HELIOS_BETRIEB_ID}'::uuid, '${v.kennzeichen}', '${v.marke}', '${v.modell}',
   '${v.vin}', ${baujahr}, ${v.km}, '${v.farbe}', '${v.kraftstoff}', ${v.preis},
   ${hubraum}, ${leistung}, ${bilder}, '${v.mobile_de_id}')${idx < vehicles.length - 1 ? ',' : ';'}`;
});

console.log(valueLines.join('\n'));

console.log(`\n-- Final check
SELECT COUNT(*) as total_vehicles,
       SUM(CASE WHEN bilder_urls IS NOT NULL THEN 1 ELSE 0 END) as with_images
FROM fahrzeuge WHERE betrieb_id = '${HELIOS_BETRIEB_ID}'::uuid;`);
