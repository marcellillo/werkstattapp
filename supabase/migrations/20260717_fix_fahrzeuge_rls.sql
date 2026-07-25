-- Fix RLS Policies for fahrzeuge (Multi-Tenant)

-- Drop old policies
DROP POLICY IF EXISTS "auth_all" ON fahrzeuge;
DROP POLICY IF EXISTS "fahrzeuge_select" ON fahrzeuge;
DROP POLICY IF EXISTS "fahrzeuge_insert" ON fahrzeuge;
DROP POLICY IF EXISTS "fahrzeuge_update" ON fahrzeuge;
DROP POLICY IF EXISTS "fahrzeuge_delete" ON fahrzeuge;

-- Create new betrieb-based policies
CREATE POLICY "fahrzeuge_select" ON fahrzeuge FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "fahrzeuge_insert" ON fahrzeuge FOR INSERT
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "fahrzeuge_update" ON fahrzeuge FOR UPDATE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "fahrzeuge_delete" ON fahrzeuge FOR DELETE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM betrieb_users
      WHERE betrieb_id = fahrzeuge.betrieb_id
      AND profile_id = auth.uid()
      AND role IN ('admin', 'werkstattmeister')
    )
  );

-- Dasselbe für kunden
DROP POLICY IF EXISTS "auth_all" ON kunden;
DROP POLICY IF EXISTS "kunden_select" ON kunden;
DROP POLICY IF EXISTS "kunden_insert" ON kunden;
DROP POLICY IF EXISTS "kunden_update" ON kunden;
DROP POLICY IF EXISTS "kunden_delete" ON kunden;

CREATE POLICY "kunden_select" ON kunden FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "kunden_insert" ON kunden FOR INSERT
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "kunden_update" ON kunden FOR UPDATE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "kunden_delete" ON kunden FOR DELETE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid()
    )
  );
