-- rechnungen (Lieferantenrechnungen-Inbox) und rechnung_positionen hatten nie
-- eine betrieb_id-Spalte, obwohl dashboard/page.tsx, buchhaltung/page.tsx und
-- alle drei /rechnungen-Routen bereits danach filtern -- diese Abfragen
-- scheiterten dadurch komplett (Spalte existiert nicht), das Dashboard-Widget
-- "Offene Eingangsrechnungen" zeigte immer 0. Zusaetzlich erlaubte die alte
-- Policy "Authenticated users" (USING true) jedem eingeloggten Nutzer jedes
-- Betriebs Lese-/Schreibzugriff auf alle Rechnungen.
--
-- Bestehende Zeilen werden Helios Automobile GmbH zugeordnet -- aktuell der
-- einzige Betrieb, der die E-Mail-Rechnungs-Synchronisation tatsaechlich nutzt.
ALTER TABLE rechnungen ADD COLUMN IF NOT EXISTS betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;

UPDATE rechnungen SET betrieb_id = (SELECT id FROM betriebe WHERE name = 'Helios Automobile GmbH')
WHERE betrieb_id IS NULL;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'rechnungen' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON rechnungen', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "betrieb_select" ON rechnungen FOR SELECT
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_insert" ON rechnungen FOR INSERT
  TO authenticated
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_update" ON rechnungen FOR UPDATE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()))
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_delete" ON rechnungen FOR DELETE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_rechnungen_betrieb ON rechnungen(betrieb_id);

-- rechnung_positionen hat keine eigene betrieb_id, wird aber ueber
-- rechnung_id -> rechnungen.betrieb_id transitiv geschuetzt.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'rechnung_positionen' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON rechnung_positionen', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "betrieb_select" ON rechnung_positionen FOR SELECT
  TO authenticated
  USING (rechnung_id IN (SELECT id FROM rechnungen WHERE betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid())));

CREATE POLICY "betrieb_insert" ON rechnung_positionen FOR INSERT
  TO authenticated
  WITH CHECK (rechnung_id IN (SELECT id FROM rechnungen WHERE betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid())));

CREATE POLICY "betrieb_delete" ON rechnung_positionen FOR DELETE
  TO authenticated
  USING (rechnung_id IN (SELECT id FROM rechnungen WHERE betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid())));
