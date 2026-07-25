const fs = require('fs');
const path = require('path');

const jsonDir = 'C:\\Users\\marce\\Downloads\\mobile_export';
const HELIOS_BETRIEB_ID = '1b500e76-081d-48c6-a17c-d777f4d6a4ab';

const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));

console.log('📋 Generated SQL queries for Supabase Console:\n');
console.log('-- Copy all queries below and paste into Supabase → SQL Editor\n');

let count = 0;
for (const file of files) {
  try {
    const jsonData = JSON.parse(fs.readFileSync(path.join(jsonDir, file), 'utf8'));
    const bNummer = jsonData.internalNumber;
    const images = (jsonData.images ?? []).map(img => img.ref).filter(Boolean);

    if (bNummer && images.length > 0) {
      const imageJson = JSON.stringify(images).replace(/'/g, "''");
      console.log(`UPDATE fahrzeuge SET bilder_urls = '${imageJson}' WHERE (kennzeichen = '${bNummer}' OR mobile_de_id = '${bNummer}') AND betrieb_id = '${HELIOS_BETRIEB_ID}'::uuid;`);
      count++;
    }
  } catch (err) {}
}

console.log(`\n-- Total: ${count} UPDATE queries`);
console.log('\n-- After running these, reload the app to see images! 🖼️');
