-- Werkstatt Update v3: Position + Sperren für Hebebühnen
ALTER TABLE hebebuehnen
  ADD COLUMN IF NOT EXISTS position int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gesperrt boolean NOT NULL DEFAULT false;

-- Initiale Positionen aus Nummer
UPDATE hebebuehnen SET position = nummer * 10;
