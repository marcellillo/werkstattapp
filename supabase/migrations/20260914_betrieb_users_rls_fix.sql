-- Die Migration 20260910_critical_rls_lockdown.sql hatte auf betrieb_users bewusst
-- nur eine SELECT-Policy gesetzt und INSERT/UPDATE/DELETE offen gelassen ("braucht
-- eine eigene, sorgfältig geprüfte Migration"). Zwischenzeitlich wurde stattdessen
-- (vermutlich manuell über das Supabase-Dashboard, beim Versuch den kaputten
-- Einladungs-Flow zu debuggen) eine Policy "users_can_access_own" angelegt, deren
-- USING-Klausel `profile_id = auth.uid() OR (auth.jwt()->>'iss') IS NOT NULL` lautet.
-- Der zweite Teil dieser Bedingung ist für praktisch jeden authentifizierten Request
-- wahr (jedes gültige Supabase-JWT hat einen "iss"-Claim), wodurch die Policy de facto
-- JEDEM eingeloggten Nutzer erlaubt, Mitgliedschaften JEDES Betriebs zu lesen,
-- anzulegen, zu ändern oder zu löschen -- inklusive Rollen-Eskalation zum Admin
-- in einem fremden Betrieb. Das wird hier durch enge, auf den eigenen Betrieb bzw.
-- die eigene Person beschränkte Policies ersetzt.

DROP POLICY IF EXISTS "users_can_access_own" ON betrieb_users;
DROP POLICY IF EXISTS "betrieb_select" ON betrieb_users;

-- SELECT: nur Mitgliedschaften des eigenen Betriebs sichtbar.
CREATE POLICY "betrieb_users_select" ON betrieb_users FOR SELECT
  TO authenticated
  USING (
    betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid())
  );

-- INSERT: entweder ein Admin/Superadmin des Betriebs fügt jemanden hinzu,
-- oder ein Nutzer nimmt seine EIGENE, an seine Email gerichtete Einladung an
-- (das ist der Fall im Registrierungs-Flow, der mit der eigenen Session des
-- neuen Nutzers läuft, nicht mit einer Admin-Session).
CREATE POLICY "betrieb_users_insert" ON betrieb_users FOR INSERT
  TO authenticated
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
    OR (
      profile_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM user_invitations
        WHERE user_invitations.betrieb_id = betrieb_users.betrieb_id
          AND lower(user_invitations.email) = lower(auth.jwt() ->> 'email')
          AND user_invitations.status IN ('pending', 'accepted')
      )
    )
  );

-- UPDATE: wie INSERT -- Admins dürfen Rollen im eigenen Betrieb ändern, ein Nutzer
-- darf seine eigene (bereits bestehende) Mitgliedschaft im Zuge einer erneuten
-- gültigen Einladung aktualisieren (der "existingUser"-Zweig im Accept-Flow).
CREATE POLICY "betrieb_users_update" ON betrieb_users FOR UPDATE
  TO authenticated
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
    OR (
      profile_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM user_invitations
        WHERE user_invitations.betrieb_id = betrieb_users.betrieb_id
          AND lower(user_invitations.email) = lower(auth.jwt() ->> 'email')
          AND user_invitations.status IN ('pending', 'accepted')
      )
    )
  )
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
    OR (
      profile_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM user_invitations
        WHERE user_invitations.betrieb_id = betrieb_users.betrieb_id
          AND lower(user_invitations.email) = lower(auth.jwt() ->> 'email')
          AND user_invitations.status IN ('pending', 'accepted')
      )
    )
  );

-- DELETE: nur Admins/Superadmins dürfen Mitglieder aus ihrem eigenen Betrieb entfernen.
CREATE POLICY "betrieb_users_delete" ON betrieb_users FOR DELETE
  TO authenticated
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );
