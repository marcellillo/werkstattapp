-- benachrichtigungen bekam bei der v12-Umstellung nur betrieb_select und
-- betrieb_insert, aber keine UPDATE-Policy. Mit RLS aktiv und ohne passende
-- Policy wird jedes UPDATE (z.B. "als gelesen markieren") von Postgres
-- standardmaessig abgelehnt -- ohne Fehleranzeige im bisherigen Code, die
-- Markierung erschien nur lokal im Browser gesetzt und war nach einem
-- Neuladen wieder weg.
CREATE POLICY "betrieb_update" ON benachrichtigungen FOR UPDATE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()))
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));
