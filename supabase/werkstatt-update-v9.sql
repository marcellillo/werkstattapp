-- werkstatt-update-v9.sql
-- Steuerliche Erfassung von Fahrzeugverkäufen (Eigenfahrzeuge)
--   einkaufspreis: was die Werkstatt beim Ankauf bezahlt hat (für Marge/Gewinn + §25a)
--   steuerart:     wie der Verkauf besteuert wird
--     'differenz' = Differenzbesteuerung §25a (MwSt nur auf Marge VK-EK)
--     'regel'     = Regelbesteuerung (19% MwSt auf vollen Verkaufspreis)
--     'ausfuhr'   = außergemeinschaftliche Lieferung / Ausfuhr (steuerfrei)

ALTER TABLE fahrzeuge ADD COLUMN IF NOT EXISTS einkaufspreis numeric(10,2);
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS steuerart text
  CHECK (steuerart IN ('differenz','regel','ausfuhr'));
