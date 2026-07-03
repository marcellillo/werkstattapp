-- werkstatt-update-v8.sql
-- Verkaufspreis (Angebotspreis) + Käufer-Name als echte Spalten
-- Ersetzt das bisherige Parsen aus notizen ("Verkaufspreis: X €") bzw.
-- bemerkungen ("Käufer: X") per Regex durch saubere Spalten.

ALTER TABLE fahrzeuge ADD COLUMN IF NOT EXISTS verkaufspreis numeric(10,2); -- Angebotspreis (Brutto)
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS kaeufer_name  text;          -- Käufer bei Verkauf

-- Backfill erfolgt danach per Script:  node scripts/backfill-preis-kaeufer.mjs
-- (überträgt vorhandene Altwerte aus notizen / bemerkungen in die neuen Spalten)
