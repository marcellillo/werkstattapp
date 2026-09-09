-- lager_artikel (Lagerbestand-Feature auf /teile) wurde offenbar direkt im
-- Supabase-Dashboard angelegt, ganz ohne betrieb_id-Spalte -- obwohl der
-- komplette Anwendungscode (teile/page.tsx, teile-content.tsx) bereits davon
-- ausgeht, dass sie existiert und danach filtert/schreibt. Dadurch war die
-- gesamte Lagerbestand-Ansicht immer leer (die Lese-Query mit
-- .eq('betrieb_id', ...) scheiterte an der fehlenden Spalte), UND die
-- bestehende RLS-Policy erlaubte offenbar jedem eingeloggten Nutzer Zugriff
-- auf ALLE Artikel aller Betriebe (kein Mandanten-Trennung möglich ohne
-- diese Spalte). Diese Migration ergänzt die Spalte und ersetzt sämtliche
-- bestehenden Policies auf der Tabelle durch betrieb-skalierte Policies,
-- exakt wie bei allen anderen Tabellen dieser App.

ALTER TABLE lager_artikel ADD COLUMN IF NOT EXISTS betrieb_id UUID REFERENCES betriebe(id) ON DELETE CASCADE;

ALTER TABLE lager_artikel ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'lager_artikel' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON lager_artikel', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "betrieb_select" ON lager_artikel FOR SELECT
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_insert" ON lager_artikel FOR INSERT
  TO authenticated
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_update" ON lager_artikel FOR UPDATE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()))
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_delete" ON lager_artikel FOR DELETE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_lager_artikel_betrieb ON lager_artikel(betrieb_id);
