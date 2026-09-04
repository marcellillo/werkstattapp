-- Speichert eine dauerhaft sichtbare Historie aller hochgeladenen Lieferschein-Scans
-- pro Kostenvoranschlag, damit Mitarbeiter nicht versehentlich denselben Lieferschein
-- zweimal hochladen und die Teile doppelt erfassen.
CREATE TABLE IF NOT EXISTS lieferschein_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  kostenvoranschlag_id UUID REFERENCES kostenvoranschlaege(id) ON DELETE CASCADE,
  datei_url TEXT NOT NULL,
  dateiname TEXT,
  lieferant TEXT,
  bestellnummer TEXT,
  lieferdatum TEXT,
  teile_anzahl INT DEFAULT 0,
  erfolg BOOLEAN DEFAULT true,
  fehlermeldung TEXT,
  vermutete_arbeit TEXT,
  erstellt_am TIMESTAMPTZ DEFAULT NOW()
);

-- Falls die Tabelle bereits ohne diese Spalte angelegt wurde
ALTER TABLE lieferschein_uploads ADD COLUMN IF NOT EXISTS vermutete_arbeit TEXT;

ALTER TABLE lieferschein_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "betrieb_select" ON lieferschein_uploads FOR SELECT
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_insert" ON lieferschein_uploads FOR INSERT
  TO authenticated
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_delete" ON lieferschein_uploads FOR DELETE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_lieferschein_uploads_kv ON lieferschein_uploads(kostenvoranschlag_id);
CREATE INDEX IF NOT EXISTS idx_lieferschein_uploads_betrieb ON lieferschein_uploads(betrieb_id);
