const fs = require('fs');
const path = require('path');

const jsonDir = 'C:\\Users\\marce\\Downloads\\mobile_export';
const HELIOS_BETRIEB_ID = '1b500e76-081d-48c6-a17c-d777f4d6a4ab';

const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
const vehicles = [];

for (const file of files) {
  try {
    const jsonData = JSON.parse(fs.readFileSync(path.join(jsonDir, file), 'utf8'));
    const bNummer = jsonData.internalNumber;
    if (!bNummer) continue;

    const marke = (jsonData.marke || '').replace(/'/g, "''");
    const modell = (jsonData.modell || '').replace(/'/g, "''");
    const images = (jsonData.images || []).map(img => img.ref).filter(Boolean);
    const bildUrlsJson = images.length > 0 ? JSON.stringify(images).replace(/'/g, "''") : null;

    vehicles.push({
      betrieb_id: HELIOS_BETRIEB_ID,
      kennzeichen: bNummer,
      marke,
      modell,
      fahrgestellnummer: (jsonData.vin || '').replace(/'/g, "''"),
      baujahr: jsonData.baujahr || null,
      kilometerstand: jsonData.km || 0,
      farbe: (jsonData.farbe || '').replace(/'/g, "''"),
      motortyp: (jsonData.kraftstoff || '').replace(/'/g, "''"),
      bilder_urls: bildUrlsJson,
      mobile_de_id: bNummer
    });
  } catch (e) {}
}

console.log(`DELETE FROM fahrzeuge WHERE betrieb_id = '${HELIOS_BETRIEB_ID}'::uuid;`);
console.log('');
console.log('INSERT INTO fahrzeuge (betrieb_id, kennzeichen, marke, modell, fahrgestellnummer, baujahr, kilometerstand, farbe, motortyp, bilder_urls, mobile_de_id) VALUES');

vehicles.forEach((v, idx) => {
  const bilder = v.bilder_urls ? `'${v.bilder_urls}'` : 'NULL';
  const baujahr = v.baujahr ? v.baujahr : 'NULL';
  const comma = idx < vehicles.length - 1 ? ',' : ';';
  console.log(`  ('${v.betrieb_id}'::uuid, '${v.kennzeichen}', '${v.marke}', '${v.modell}', '${v.fahrgestellnummer}', ${baujahr}, ${v.kilometerstand}, '${v.farbe}', '${v.motortyp}', ${bilder}, '${v.mobile_de_id}')${comma}`);
});

console.log('');
console.log(`SELECT COUNT(*) FROM fahrzeuge WHERE betrieb_id = '${HELIOS_BETRIEB_ID}'::uuid;`);
