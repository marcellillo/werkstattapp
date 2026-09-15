-- Fehlende DELETE-Policy für user_invitations nachtragen.
-- Ohne sie konnte eine Einladung (z.B. eine abgelaufene) nicht storniert/gelöscht werden.
CREATE POLICY "delete_own_betrieb" ON user_invitations FOR DELETE
  USING (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users
    WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
  ));
