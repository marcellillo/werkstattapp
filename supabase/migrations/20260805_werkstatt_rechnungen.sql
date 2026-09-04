-- Migration: Werkstatt-Rechnungen und Positionen
-- Für Rechnungen aus Werkstattaufträgen

CREATE TABLE IF NOT EXISTS werkstatt_rechnungen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  werkstattauftrag_id UUID REFERENCES werkstattauftraege(id) ON DELETE SET NULL,
  fahrzeug_id UUID REFERENCES fahrzeuge(id) ON DELETE SET NULL,

  -- Rechnungs-Details
  nummer TEXT NOT NULL UNIQUE,
  datum DATE DEFAULT CURRENT_DATE,
  typ TEXT DEFAULT 'werkstatt' CHECK (typ IN ('werkstatt', 'verkauf')),
  status TEXT DEFAULT 'entwurf' CHECK (status IN ('entwurf', 'versendet', 'bezahlt', 'storniert')),

  -- Summen
  summe_netto NUMERIC(12,2) DEFAULT 0,
  summe_mwst NUMERIC(12,2) DEFAULT 0,
  summe_brutto NUMERIC(12,2) DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS werkstatt_rechnungen_positionen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  werkstatt_rechnungen_id UUID NOT NULL REFERENCES werkstatt_rechnungen(id) ON DELETE CASCADE,
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,

  -- Position-Details
  beschreibung TEXT NOT NULL,
  menge NUMERIC(10,2) DEFAULT 1,
  einzelpreis NUMERIC(10,2),
  gesamtpreis NUMERIC(10,2),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_werkstatt_rechnungen_betrieb_id ON werkstatt_rechnungen(betrieb_id);
CREATE INDEX idx_werkstatt_rechnungen_werkstattauftrag_id ON werkstatt_rechnungen(werkstattauftrag_id);
CREATE INDEX idx_werkstatt_rechnungen_fahrzeug_id ON werkstatt_rechnungen(fahrzeug_id);
CREATE INDEX idx_werkstatt_rechnungen_positionen_rechnung_id ON werkstatt_rechnungen_positionen(werkstatt_rechnungen_id);

-- RLS
ALTER TABLE werkstatt_rechnungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE werkstatt_rechnungen_positionen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Betrieb users can read their werkstatt_rechnungen"
  ON werkstatt_rechnungen FOR SELECT
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Betrieb users can create werkstatt_rechnungen"
  ON werkstatt_rechnungen FOR INSERT
  TO authenticated
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Betrieb users can update werkstatt_rechnungen"
  ON werkstatt_rechnungen FOR UPDATE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Betrieb users can read their werkstatt_rechnungen_positionen"
  ON werkstatt_rechnungen_positionen FOR SELECT
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Betrieb users can create werkstatt_rechnungen_positionen"
  ON werkstatt_rechnungen_positionen FOR INSERT
  TO authenticated
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));
