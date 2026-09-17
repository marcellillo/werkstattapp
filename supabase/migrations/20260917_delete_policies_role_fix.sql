-- Die DELETE-Policies auf auftraege, fahrzeuge und kunden prüfen
-- `role = ANY (ARRAY['admin', 'werkstattmeister'])`. Die Rolle 'werkstattmeister'
-- existiert im Rollensystem der App nicht (gültige Rollen: admin, superadmin,
-- mechaniker, buchhalter, verkaeufer -- siehe src/lib/rollen-context.tsx) und
-- 'superadmin' fehlt in der Liste komplett. Ergebnis: ein Superadmin (oder jede
-- andere Rolle außer 'admin') klickt "Löschen", die Policy filtert die Zeile
-- einfach aus dem DELETE heraus (0 betroffene Zeilen, KEIN Fehler von Postgres/
-- RLS) -- der Datensatz bleibt unverändert bestehen, ohne dass irgendwo ein
-- Fehler sichtbar wird. Gemeldet als "Auftrag gelöscht, aber weiterhin
-- vorhanden". Betrifft identisch auch Fahrzeuge und Kunden löschen.
--
-- fahrzeuge hatte zusätzlich zwei Policies mit demselben Bug (betrieb_delete
-- und fahrzeuge_delete aus verschiedenen Migrationen) -- hier zu einer
-- zusammengefasst.

DROP POLICY IF EXISTS "betrieb_delete" ON auftraege;
CREATE POLICY "betrieb_delete" ON auftraege FOR DELETE
  TO authenticated
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "betrieb_delete" ON fahrzeuge;
DROP POLICY IF EXISTS "fahrzeuge_delete" ON fahrzeuge;
CREATE POLICY "fahrzeuge_delete" ON fahrzeuge FOR DELETE
  TO authenticated
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "betrieb_delete" ON kunden;
CREATE POLICY "betrieb_delete" ON kunden FOR DELETE
  TO authenticated
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users
      WHERE profile_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );
