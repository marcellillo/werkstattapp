-- Zwei zusammenhängende RLS-Lücken beheben:
--
-- 1) user_invitations: Die ursprünglichen "*_own_betrieb"-Policies vergleichen
--    fälschlich `user_invitations.rolle = 'admin'` (die Rolle IN DER EINLADUNG
--    selbst) statt der Rolle des anfragenden Nutzers in betrieb_users -- ein
--    Tippfehler/Spaltenverwechslung. Da zusätzlich generische "Enable ... for
--    authenticated users"-Policies (USING auth.uid() IS NOT NULL) bestehen,
--    kann JEDER eingeloggte Nutzer JEDES Betriebs Einladungen (inkl. Tokens!)
--    aller Betriebe lesen, anlegen, ändern und löschen. Der Registrierungs-Flow
--    für einen noch nicht eingeloggten Einlader läuft ohnehin komplett über den
--    Admin-Client (siehe /api/invitations/get und /api/invitations/accept) und
--    ist von diesen Policies unabhängig -- daher können sie hier sauber auf
--    "nur Admin/Superadmin des eigenen Betriebs" verengt werden.
--
-- 2) betrieb_users: "users_can_access_own" mit
--    `profile_id = auth.uid() OR (auth.jwt()->>'iss') IS NOT NULL` ist für
--    praktisch jeden authentifizierten Request wahr (jedes gültige Supabase-JWT
--    hat einen "iss"-Claim) -- erlaubt jedem eingeloggten Nutzer, Mitgliedschaften
--    JEDES Betriebs zu lesen/anzulegen/ändern/löschen, inkl. Rollen-Eskalation in
--    einem fremden Betrieb. Der einzige Schreibpfad im Code (Einladung annehmen)
--    läuft nach der Umstellung auf den Admin-Client ebenfalls RLS-unabhängig,
--    daher genügt hier eine reine Admin/Superadmin-Policy ohne Sonderfall für
--    Selbst-Beitritt.

-- ── user_invitations ──
DROP POLICY IF EXISTS "select_own_betrieb" ON user_invitations;
DROP POLICY IF EXISTS "create_own_betrieb" ON user_invitations;
DROP POLICY IF EXISTS "update_own_betrieb" ON user_invitations;
DROP POLICY IF EXISTS "delete_own_betrieb" ON user_invitations;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON user_invitations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON user_invitations;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON user_invitations;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON user_invitations;

CREATE POLICY "user_invitations_select" ON user_invitations FOR SELECT
  TO authenticated
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "user_invitations_insert" ON user_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "user_invitations_update" ON user_invitations FOR UPDATE
  TO authenticated
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "user_invitations_delete" ON user_invitations FOR DELETE
  TO authenticated
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- ── betrieb_users ──
DROP POLICY IF EXISTS "users_can_access_own" ON betrieb_users;
DROP POLICY IF EXISTS "betrieb_select" ON betrieb_users;

CREATE POLICY "betrieb_users_select" ON betrieb_users FOR SELECT
  TO authenticated
  USING (
    betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid())
  );

CREATE POLICY "betrieb_users_insert" ON betrieb_users FOR INSERT
  TO authenticated
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "betrieb_users_update" ON betrieb_users FOR UPDATE
  TO authenticated
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "betrieb_users_delete" ON betrieb_users FOR DELETE
  TO authenticated
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- service_role_bypass (ALL, auth.role() = 'service_role') bleibt unverändert
-- bestehen -- der Admin-Client in den API-Routen umgeht RLS damit weiterhin.
