-- Add gesamt_betrag column to kostenvoranschlaege if it doesn't exist
ALTER TABLE kostenvoranschlaege
ADD COLUMN IF NOT EXISTS gesamt_betrag NUMERIC(10,2) DEFAULT 0;
