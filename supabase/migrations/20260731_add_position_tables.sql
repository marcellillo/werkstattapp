-- Migration: Create werkstattauftrag_positionen and kostenvoranschlag_position tables
-- These tables store line items for work orders and cost estimates

-- ============================================================================
-- Werkstattauftrag Positionen (Work Order Line Items)
-- ============================================================================
CREATE TABLE IF NOT EXISTS werkstattauftrag_positionen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  werkstattauftrag_id UUID NOT NULL REFERENCES werkstattauftraege(id) ON DELETE CASCADE,
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,

  -- Line Item Details
  beschreibung TEXT NOT NULL,
  menge NUMERIC(10,2) DEFAULT 1,
  einzelpreis NUMERIC(10,2),
  gesamtpreis NUMERIC(10,2),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_werkstattauftrag_positionen_werkstattauftrag_id
  ON werkstattauftrag_positionen(werkstattauftrag_id);
CREATE INDEX idx_werkstattauftrag_positionen_betrieb_id
  ON werkstattauftrag_positionen(betrieb_id);

-- RLS
ALTER TABLE werkstattauftrag_positionen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Betrieb users can read their werkstattauftrag_positionen"
  ON werkstattauftrag_positionen FOR SELECT
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Betrieb users can create werkstattauftrag_positionen"
  ON werkstattauftrag_positionen FOR INSERT
  TO authenticated
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Betrieb users can update werkstattauftrag_positionen"
  ON werkstattauftrag_positionen FOR UPDATE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Betrieb users can delete werkstattauftrag_positionen"
  ON werkstattauftrag_positionen FOR DELETE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- Kostenvoranschlag Positionen (Cost Estimate Line Items)
-- ============================================================================
CREATE TABLE IF NOT EXISTS kostenvoranschlag_position (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kostenvoranschlag_id UUID NOT NULL REFERENCES kostenvoranschlaege(id) ON DELETE CASCADE,
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,

  -- Line Item Details
  beschreibung TEXT NOT NULL,
  menge NUMERIC(10,2) DEFAULT 1,
  einzelpreis NUMERIC(10,2),
  gesamtpreis NUMERIC(10,2),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_kostenvoranschlag_position_kostenvoranschlag_id
  ON kostenvoranschlag_position(kostenvoranschlag_id);
CREATE INDEX idx_kostenvoranschlag_position_betrieb_id
  ON kostenvoranschlag_position(betrieb_id);

-- RLS
ALTER TABLE kostenvoranschlag_position ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Betrieb users can read their kostenvoranschlag_position"
  ON kostenvoranschlag_position FOR SELECT
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Betrieb users can create kostenvoranschlag_position"
  ON kostenvoranschlag_position FOR INSERT
  TO authenticated
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Betrieb users can update kostenvoranschlag_position"
  ON kostenvoranschlag_position FOR UPDATE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Betrieb users can delete kostenvoranschlag_position"
  ON kostenvoranschlag_position FOR DELETE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM profiles WHERE id = auth.uid()));
