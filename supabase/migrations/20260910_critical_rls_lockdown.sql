-- KRITISCH: betrieb_einstellungen, betrieb_users und betriebe hatten gar keine
-- Row-Level-Security. Damit konnte JEDER ohne Login (nur mit dem oeffentlichen
-- anon-Key) saemtliche Firmeneinstellungen aller Betriebe lesen -- inklusive
-- eines echten, nutzbaren Anthropic-API-Keys von Helios Automobile GmbH im
-- Klartext. Dieser Key muss zusaetzlich zu dieser Migration manuell im
-- Anthropic-Dashboard widerrufen/neu erzeugt werden, das kann keine SQL-
-- Migration erledigen.

-- betrieb_einstellungen: enthaelt Firmendaten, IMAP/Graph-Zugangsdaten, API-Keys.
-- Alle bestehenden Lese-/Schreibpfade (Einstellungen-Seite, betrieb-settings/save
-- Route, Rechnungs-Routen) filtern bereits selbst nach betrieb_id -- diese
-- Policies aendern daran nichts, sie schliessen nur den anonymen Zugriff.
ALTER TABLE betrieb_einstellungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "betrieb_select" ON betrieb_einstellungen FOR SELECT
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_insert" ON betrieb_einstellungen FOR INSERT
  TO authenticated
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_update" ON betrieb_einstellungen FOR UPDATE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()))
  WITH CHECK (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

CREATE POLICY "betrieb_delete" ON betrieb_einstellungen FOR DELETE
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

-- betrieb_users: die Mitgliedschafts-Tabelle, auf der ALLE anderen Policies in
-- dieser App aufbauen ("betrieb_id IN (SELECT betrieb_id FROM betrieb_users
-- WHERE profile_id = auth.uid())"). Nur SELECT wird hier gesperrt -- INSERT/
-- UPDATE/DELETE (Einladungen annehmen etc.) bewusst NICHT angefasst, das
-- braucht eine eigene, sorgfältig geprüfte Migration, damit der bestehende
-- Einladungs-Flow nicht kaputtgeht.
ALTER TABLE betrieb_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "betrieb_select" ON betrieb_users FOR SELECT
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

-- betriebe: die Mandanten-Tabelle selbst. Kein Code im Repo fügt clientseitig
-- neue Betriebe ein, daher nur eine SELECT-Policy -- INSERT/UPDATE/DELETE
-- bleiben ohne Policy und sind damit für anon/authenticated automatisch
-- gesperrt (nur der service_role-Key, der RLS umgeht, kann noch schreiben).
ALTER TABLE betriebe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "betrieb_select" ON betriebe FOR SELECT
  TO authenticated
  USING (id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

-- betrieb_payment_events / betrieb_subscription: die CREATE POLICY-Statements
-- existieren bereits in einer früheren Migration, aber RLS wurde nie
-- eingeschaltet, wodurch diese Policies bisher wirkungslos waren. Die
-- bestehende INSERT-Policy auf betrieb_payment_events ("WITH CHECK (TRUE)",
-- ohne Rollen-Einschränkung) würde beim Einschalten von RLS aber weiterhin
-- jedem -- auch anonym -- das Einfügen erlauben. Kein Code im Repo schreibt
-- aktuell in diese Tabelle (die Stripe-Webhook-Anbindung ist noch nicht
-- implementiert); ein künftiger Webhook-Handler sollte ohnehin den
-- service_role-Key nutzen, der RLS umgeht und daher keine solche Policy
-- braucht. Die Policy wird daher entfernt statt aktiviert zu bleiben.
ALTER TABLE betrieb_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE betrieb_subscription ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "betrieb_payment_events_insert" ON betrieb_payment_events;

-- profiles: trug bisher "auth_all" FOR ALL USING (auth.uid() IS NOT NULL) --
-- jeder eingeloggte Nutzer (aus jedem Betrieb) konnte jedes Profil lesen UND
-- verändern, inklusive der role-Spalte anderer Nutzer (Rechte-Ausweitung über
-- Mandantengrenzen hinweg). Das Anlegen neuer Profile läuft über den
-- SECURITY DEFINER-Trigger handle_new_user (umgeht RLS), braucht also keine
-- eigene INSERT-Policy für normale Nutzer. Alle bestehenden Policies werden
-- dynamisch entfernt (nicht nur "auth_all"), falls im Laufe der Zeit noch
-- eine zweite, anders benannte Policy aus einer älteren Schema-Datei aktiv
-- geworden ist.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "self_or_colleague_select" ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR id IN (
      SELECT profile_id FROM betrieb_users
      WHERE betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid())
    )
  );

CREATE POLICY "self_update" ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
