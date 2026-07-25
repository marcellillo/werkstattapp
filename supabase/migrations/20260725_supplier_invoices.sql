-- Lieferanten-Rechnungen Tabelle
CREATE TABLE supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  fahrzeug_id UUID NOT NULL REFERENCES fahrzeuge(id) ON DELETE CASCADE,

  -- Rechnungs-Details
  rechnungsnummer TEXT,
  lieferant TEXT,
  rechnungsdatum DATE,
  betrag DECIMAL(10, 2),

  -- File
  datei_url TEXT NOT NULL,
  datei_name TEXT NOT NULL,
  datei_typ TEXT, -- 'pdf', 'image', etc

  -- Metadata
  notizen TEXT,
  erstellt_am TIMESTAMPTZ DEFAULT NOW(),
  aktualisiert_am TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT betrieb_isolation UNIQUE (betrieb_id, fahrzeug_id, id)
);

-- Indexes
CREATE INDEX idx_supplier_invoices_betrieb ON supplier_invoices(betrieb_id);
CREATE INDEX idx_supplier_invoices_fahrzeug ON supplier_invoices(fahrzeug_id);
CREATE INDEX idx_supplier_invoices_created ON supplier_invoices(erstellt_am DESC);

-- RLS Policies
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "betrieb_select" ON supplier_invoices FOR SELECT
  USING (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()
  ));

CREATE POLICY "betrieb_insert" ON supplier_invoices FOR INSERT
  WITH CHECK (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()
  ));

CREATE POLICY "betrieb_update" ON supplier_invoices FOR UPDATE
  USING (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()
  ));

CREATE POLICY "betrieb_delete" ON supplier_invoices FOR DELETE
  USING (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()
  ));
