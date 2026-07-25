const fs = require('fs');
const path = require('path');

const jsonDir = 'C:\\Users\\marce\\Downloads\\mobile_export';
const outputFile = 'C:\\Users\\marce\\Downloads\\mobile_fahrzeuge_clean.csv';

const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
const vehicles = [];

console.log(`📋 Reading ${files.length} JSON files from ${jsonDir}\n`);

for (const file of files) {
  try {
    const jsonData = JSON.parse(fs.readFileSync(path.join(jsonDir, file), 'utf8'));
    const bNummer = jsonData.internalNumber;
    if (!bNummer) continue;

    const images = (jsonData.images || []).map(img => img.ref).filter(Boolean);
    const imageUrls = images.join('|'); // Pipe-separated for CSV

    vehicles.push({
      internalNumber: bNummer,
      make: jsonData.make || '',
      model: jsonData.model || '',
      modelDescription: jsonData.modell || '',
      vin: jsonData.vin || '',
      firstRegistration: jsonData.baujahr || '',
      mileage: jsonData.km || '',
      exteriorColor: jsonData.farbe || '',
      fuel: jsonData.kraftstoff || '',
      price: jsonData.preis || '',
      cubicCapacity: jsonData.hubraum || '',
      power: jsonData.leistung || '',
      images: imageUrls,
    });
  } catch (e) {
    console.error(`❌ Error parsing ${file}:`, e.message);
  }
}

// Write CSV with headers
const headers = ['internalNumber', 'make', 'model', 'modelDescription', 'vin', 'firstRegistration', 'mileage', 'exteriorColor', 'fuel', 'price', 'cubicCapacity', 'power', 'images'];
const csvLines = [headers.map(h => `"${h}"`).join(',')];

for (const v of vehicles) {
  const row = headers.map(h => {
    const val = v[h] || '';
    return `"${String(val).replace(/"/g, '""')}"`;
  }).join(',');
  csvLines.push(row);
}

fs.writeFileSync(outputFile, csvLines.join('\n'), 'utf8');

console.log(`\n✅ CSV generated successfully!`);
console.log(`📍 File: ${outputFile}`);
console.log(`📊 Vehicles: ${vehicles.length}`);
console.log(`🖼️  With images: ${vehicles.filter(v => v.images).length}`);
