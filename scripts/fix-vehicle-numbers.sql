-- Fix: Update all eigen fahrzeuge with kennzeichen from mobile_export JSON
-- This script matches vehicles by existence and updates kennzeichen/mobile_de_id

-- First, check what we have
SELECT COUNT(*) as total,
       COUNT(CASE WHEN kennzeichen LIKE 'B-%' THEN 1 END) as with_b_nummer,
       COUNT(CASE WHEN mobile_de_id IS NOT NULL THEN 1 END) as with_mobile_de_id,
       COUNT(CASE WHEN bilder_urls IS NOT NULL THEN 1 END) as with_images
FROM fahrzeuge
WHERE fahrzeug_typ = 'eigen';

-- Show first 5 vehicles to diagnose
SELECT id, kennzeichen, mobile_de_id, fahrzeug_typ, marke, modell, bilder_urls
FROM fahrzeuge
WHERE fahrzeug_typ = 'eigen'
LIMIT 5;
