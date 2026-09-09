-- Erlaubt die Wahl zwischen einer detaillierten Rechnung (mit Einzelpreisen je Position)
-- und einer pauschalen Rechnung (nur Positionsbezeichnungen, ohne Einzelpreise, nur Summen).
ALTER TABLE kunden_rechnungen ADD COLUMN IF NOT EXISTS anzeige_modus TEXT NOT NULL DEFAULT 'detailliert' CHECK (anzeige_modus IN ('detailliert', 'pauschal'));
