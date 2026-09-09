-- Verknuepft Kostenvoranschlag-Positionen mit dem urspruenglichen Ersatzteil,
-- damit bereits erfasste Ersatzteile automatisch in die Rechnung uebernommen
-- werden koennen, ohne sie beim naechsten Rechnungslauf ein zweites Mal
-- (und damit doppelt) abzurechnen.
ALTER TABLE kostenvoranschlag_position ADD COLUMN IF NOT EXISTS ersatzteil_id UUID REFERENCES ersatzteile(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kostenvoranschlag_position_ersatzteil ON kostenvoranschlag_position(ersatzteil_id);
