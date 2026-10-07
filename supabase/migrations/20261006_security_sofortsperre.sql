-- SICHERHEIT, Sofortsperre (2026-10-07):
-- Bei diesen Tabellen war der Zeilenschutz (RLS) AUSGESCHALTET bzw. gab es Regeln für "anon",
-- und die Rolle "anon" (= jeder Besucher mit dem öffentlichen Schlüssel aus dem Browser) hatte
-- volle Rechte. Ohne Anmeldung konnte man u. a. betrieb_einstellungen (API-Schlüssel, Microsoft-
-- Secret, Tokens), betriebe, betrieb_users, Kostenvoranschläge und Werkstattaufträge LESEN,
-- ÄNDERN und LÖSCHEN.
--
-- Diese Datei entzieht "anon" jeden Zugriff. Kein legitimer Ablauf braucht ihn:
--  * eingeloggte Nutzer arbeiten als Rolle "authenticated" (unverändert),
--  * öffentliche Routen (Buchung, Status, Einladung) laufen über den Server mit Service-Role,
--  * die Webseite (helios-app) benutzt ein anderes Supabase-Projekt.
-- Die eigentliche Absicherung (RLS einschalten, Regeln je Betrieb) folgt in 20261007_security_rls.sql.

REVOKE ALL ON TABLE
  arbeitszeiten, betrieb_einstellungen, betrieb_payment_events, betrieb_subscription,
  betrieb_users, betriebe, fahrzeug_rechnungen, kostenvoranschlaege, kostenvoranschlag_positionen,
  rechnungs_positionen, werkstattauftraege,
  website_kunden, website_leistungen_log, website_nachrichten, website_termine
FROM anon;

-- Die offenen "anon"-Regeln der (vom App-Code nicht genutzten) website_*-Tabellen entfernen
DROP POLICY IF EXISTS website_kunden_all ON website_kunden;
DROP POLICY IF EXISTS website_leistungen_log_all ON website_leistungen_log;
DROP POLICY IF EXISTS website_nachrichten_all ON website_nachrichten;
DROP POLICY IF EXISTS website_termine_all ON website_termine;
