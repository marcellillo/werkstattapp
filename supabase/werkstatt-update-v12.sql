-- v12: Multi-Tenant Architecture for SaaS
-- Adds betriebe (tenant) table, user-to-betrieb mapping, and data isolation via RLS

-- ============================================================================
-- PHASE 1: Create Core Tenant Tables
-- ============================================================================

-- Core tenant table
CREATE TABLE betriebe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-to-Betrieb mapping (1 user can belong to multiple betriebe)
CREATE TABLE betrieb_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'mechaniker'
    CHECK (role IN ('admin', 'werkstattmeister', 'mechaniker', 'buchhalter')),
  is_primary BOOLEAN DEFAULT FALSE,
  UNIQUE(betrieb_id, profile_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Betrieb-specific settings (replaces global werkstatt_einstellungen)
CREATE TABLE betrieb_einstellungen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  schluessel TEXT NOT NULL,
  wert TEXT,
  UNIQUE(betrieb_id, schluessel),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PHASE 1 cont: Add betrieb_id to all data tables
-- ============================================================================

ALTER TABLE kunden ADD COLUMN betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;
ALTER TABLE fahrzeuge ADD COLUMN betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;
ALTER TABLE auftraege ADD COLUMN betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;
ALTER TABLE ersatzteile ADD COLUMN betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;
ALTER TABLE status_historie ADD COLUMN betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;
ALTER TABLE email_protokoll ADD COLUMN betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;
ALTER TABLE benachrichtigungen ADD COLUMN betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;
ALTER TABLE termine ADD COLUMN betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;
ALTER TABLE auftrag_fotos ADD COLUMN betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;
ALTER TABLE kunden_rechnungen ADD COLUMN betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;
ALTER TABLE fahrzeug_rechnungen ADD COLUMN betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;

-- ============================================================================
-- PHASE 1 cont: Create indexes for performance
-- ============================================================================

CREATE INDEX idx_betrieb_users_betrieb ON betrieb_users(betrieb_id);
CREATE INDEX idx_betrieb_users_profile ON betrieb_users(profile_id);
CREATE INDEX idx_betrieb_einstellungen_betrieb ON betrieb_einstellungen(betrieb_id);

CREATE INDEX idx_kunden_betrieb ON kunden(betrieb_id);
CREATE INDEX idx_fahrzeuge_betrieb ON fahrzeuge(betrieb_id);
CREATE INDEX idx_auftraege_betrieb ON auftraege(betrieb_id);
CREATE INDEX idx_ersatzteile_betrieb ON ersatzteile(betrieb_id);
CREATE INDEX idx_status_historie_betrieb ON status_historie(betrieb_id);
CREATE INDEX idx_email_protokoll_betrieb ON email_protokoll(betrieb_id);
CREATE INDEX idx_benachrichtigungen_betrieb ON benachrichtigungen(betrieb_id);
CREATE INDEX idx_termine_betrieb ON termine(betrieb_id);
CREATE INDEX idx_auftrag_fotos_betrieb ON auftrag_fotos(betrieb_id);
CREATE INDEX idx_kunden_rechnungen_betrieb ON kunden_rechnungen(betrieb_id);
CREATE INDEX idx_fahrzeug_rechnungen_betrieb ON fahrzeug_rechnungen(betrieb_id);

-- ============================================================================
-- PHASE 2: Drop old permissive RLS policies and create betrieb-isolation policies
-- ============================================================================

-- Drop old policies (they are too permissive)
DROP POLICY IF EXISTS "auth_all" ON kunden;
DROP POLICY IF EXISTS "auth_all" ON fahrzeuge;
DROP POLICY IF EXISTS "auth_all" ON auftraege;
DROP POLICY IF EXISTS "auth_all" ON ersatzteile;
DROP POLICY IF EXISTS "auth_all" ON status_historie;
DROP POLICY IF EXISTS "auth_all" ON email_protokoll;
DROP POLICY IF EXISTS "auth_all" ON benachrichtigungen;
DROP POLICY IF EXISTS "auth_all" ON termine;
DROP POLICY IF EXISTS "auth_all" ON auftrag_fotos;
DROP POLICY IF EXISTS "auth_all" ON kunden_rechnungen;
DROP POLICY IF EXISTS "auth_all" ON fahrzeug_rechnungen;

-- ============================================================================
-- Betrieb Isolation Policies for KUNDEN
-- ============================================================================

CREATE POLICY "betrieb_select" ON kunden FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_insert" ON kunden FOR INSERT
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_update" ON kunden FOR UPDATE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_delete" ON kunden FOR DELETE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
      AND role IN ('admin', 'werkstattmeister')
    )
  );

-- ============================================================================
-- Betrieb Isolation Policies for FAHRZEUGE
-- ============================================================================

CREATE POLICY "betrieb_select" ON fahrzeuge FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_insert" ON fahrzeuge FOR INSERT
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_update" ON fahrzeuge FOR UPDATE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_delete" ON fahrzeuge FOR DELETE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
      AND role IN ('admin', 'werkstattmeister')
    )
  );

-- ============================================================================
-- Betrieb Isolation Policies for AUFTRAEGE
-- ============================================================================

CREATE POLICY "betrieb_select" ON auftraege FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_insert" ON auftraege FOR INSERT
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_update" ON auftraege FOR UPDATE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_delete" ON auftraege FOR DELETE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
      AND role IN ('admin', 'werkstattmeister')
    )
  );

-- ============================================================================
-- Betrieb Isolation Policies for ERSATZTEILE
-- ============================================================================

CREATE POLICY "betrieb_select" ON ersatzteile FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_insert" ON ersatzteile FOR INSERT
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_update" ON ersatzteile FOR UPDATE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

-- ============================================================================
-- Betrieb Isolation Policies for STATUS_HISTORIE
-- ============================================================================

CREATE POLICY "betrieb_select" ON status_historie FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_insert" ON status_historie FOR INSERT
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

-- ============================================================================
-- Betrieb Isolation Policies for EMAIL_PROTOKOLL
-- ============================================================================

CREATE POLICY "betrieb_select" ON email_protokoll FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_insert" ON email_protokoll FOR INSERT
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

-- ============================================================================
-- Betrieb Isolation Policies for BENACHRICHTIGUNGEN
-- ============================================================================

CREATE POLICY "betrieb_select" ON benachrichtigungen FOR SELECT
  USING (
    benutzer_id = auth.uid()
    AND betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_insert" ON benachrichtigungen FOR INSERT
  WITH CHECK (
    benutzer_id = auth.uid()
    AND betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

-- ============================================================================
-- Betrieb Isolation Policies for TERMINE
-- ============================================================================

CREATE POLICY "betrieb_select" ON termine FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_insert" ON termine FOR INSERT
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_update" ON termine FOR UPDATE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

-- ============================================================================
-- Betrieb Isolation Policies for AUFTRAG_FOTOS
-- ============================================================================

CREATE POLICY "betrieb_select" ON auftrag_fotos FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_insert" ON auftrag_fotos FOR INSERT
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

-- ============================================================================
-- Betrieb Isolation Policies for KUNDEN_RECHNUNGEN
-- ============================================================================

CREATE POLICY "betrieb_select" ON kunden_rechnungen FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_insert" ON kunden_rechnungen FOR INSERT
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

-- ============================================================================
-- Betrieb Isolation Policies for FAHRZEUG_RECHNUNGEN
-- ============================================================================

CREATE POLICY "betrieb_select" ON fahrzeug_rechnungen FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "betrieb_insert" ON fahrzeug_rechnungen FOR INSERT
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

-- ============================================================================
-- PHASE 6: Migrate existing data to default betrieb
-- ============================================================================

-- Create default betrieb for existing single-tenant data
INSERT INTO betriebe (name)
VALUES ('Standardwerkstatt')
ON CONFLICT(name) DO NOTHING;

-- Set default betrieb_id on all existing data
UPDATE kunden SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt') WHERE betrieb_id IS NULL;
UPDATE fahrzeuge SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt') WHERE betrieb_id IS NULL;
UPDATE auftraege SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt') WHERE betrieb_id IS NULL;
UPDATE ersatzteile SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt') WHERE betrieb_id IS NULL;
UPDATE status_historie SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt') WHERE betrieb_id IS NULL;
UPDATE email_protokoll SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt') WHERE betrieb_id IS NULL;
UPDATE benachrichtigungen SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt') WHERE betrieb_id IS NULL;
UPDATE termine SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt') WHERE betrieb_id IS NULL;
UPDATE auftrag_fotos SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt') WHERE betrieb_id IS NULL;
UPDATE kunden_rechnungen SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt') WHERE betrieb_id IS NULL;
UPDATE fahrzeug_rechnungen SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt') WHERE betrieb_id IS NULL;

-- Migrate werkstatt_einstellungen to betrieb_einstellungen
INSERT INTO betrieb_einstellungen (betrieb_id, schluessel, wert)
SELECT (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt'), schluessel, wert FROM werkstatt_einstellungen
ON CONFLICT(betrieb_id, schluessel) DO NOTHING;

-- Add all current users to default betrieb
INSERT INTO betrieb_users (betrieb_id, profile_id, role, is_primary)
SELECT (SELECT id FROM betriebe WHERE name = 'Standardwerkstatt'), id, role, TRUE FROM profiles
ON CONFLICT(betrieb_id, profile_id) DO NOTHING;

-- ============================================================================
-- PHASE 6 cont: Set constraints to NOT NULL after migration
-- ============================================================================

ALTER TABLE kunden ALTER COLUMN betrieb_id SET NOT NULL;
ALTER TABLE fahrzeuge ALTER COLUMN betrieb_id SET NOT NULL;
ALTER TABLE auftraege ALTER COLUMN betrieb_id SET NOT NULL;
ALTER TABLE ersatzteile ALTER COLUMN betrieb_id SET NOT NULL;
ALTER TABLE status_historie ALTER COLUMN betrieb_id SET NOT NULL;
ALTER TABLE email_protokoll ALTER COLUMN betrieb_id SET NOT NULL;
ALTER TABLE benachrichtigungen ALTER COLUMN betrieb_id SET NOT NULL;
ALTER TABLE termine ALTER COLUMN betrieb_id SET NOT NULL;
ALTER TABLE auftrag_fotos ALTER COLUMN betrieb_id SET NOT NULL;
ALTER TABLE kunden_rechnungen ALTER COLUMN betrieb_id SET NOT NULL;
ALTER TABLE fahrzeug_rechnungen ALTER COLUMN betrieb_id SET NOT NULL;
