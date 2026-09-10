-- hebebuehnen hatte nie eine betrieb_id-Spalte -- alle Betriebe teilten sich
-- dieselben 4 Buehnen im Dashboard/Hebebuehnen-Bereich. Bestehende Zeilen
-- werden Helios Automobile GmbH zugeordnet (die einzige echte, aktiv
-- genutzte Werkstatt der beiden aktuell existierenden Betriebe).
ALTER TABLE hebebuehnen ADD COLUMN IF NOT EXISTS betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;

UPDATE hebebuehnen SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Helios Automobile GmbH')
WHERE betrieb_id IS NULL;

ALTER TABLE hebebuehnen ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'hebebuehnen' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON hebebuehnen', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "betrieb_select" ON hebebuehnen FOR SELECT
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_insert" ON hebebuehnen FOR INSERT
  TO authenticated
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_update" ON hebebuehnen FOR UPDATE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()))
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_delete" ON hebebuehnen FOR DELETE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_hebebuehnen_betrieb ON hebebuehnen(betrieb_id);
