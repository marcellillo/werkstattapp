-- Update v5: Hebebühne direkt am Termin speichern
ALTER TABLE termine ADD COLUMN IF NOT EXISTS hebebuehne_id uuid REFERENCES hebebuehnen(id) ON DELETE SET NULL;
