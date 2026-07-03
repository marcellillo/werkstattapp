-- werkstatt-update-v10.sql
-- Fahrzeug-Verkaufs-Rechnungen (Autohandel)

CREATE TABLE IF NOT EXISTS fahrzeug_rechnungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid NOT NULL UNIQUE REFERENCES auftraege(id) ON DELETE CASCADE,
  fahrzeug_id uuid NOT NULL REFERENCES fahrzeuge(id),
  rechnungsnummer integer NOT NULL UNIQUE,

  -- PDF-Datei (falls gespeichert)
  pdf_url text,

  -- E-Mail-Versand
  versandt_am timestamp with time zone,
  versandt_an text,

  -- Audit
  erstellt_am timestamp with time zone DEFAULT now(),
  aktualisiert_am timestamp with time zone DEFAULT now()
);

CREATE INDEX fahrzeug_rechnungen_auftrag_id ON fahrzeug_rechnungen(auftrag_id);
CREATE INDEX fahrzeug_rechnungen_fahrzeug_id ON fahrzeug_rechnungen(fahrzeug_id);
