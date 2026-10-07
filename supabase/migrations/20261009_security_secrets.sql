-- SICHERHEIT: Zugangsdaten (API-Schlüssel, Passwörter, Secrets, Tokens) nur noch für den Server (2026-10-07)
--
-- Bisher durften Betriebsmitglieder alle betrieb_einstellungen lesen -- inkl. Anthropic-/Resend-Schlüssel
-- und Microsoft-Tokens (und die Einstellungsseite lieferte sie sogar an den Browser). Jetzt sind Zeilen,
-- deren Schlüsselname api_key/password/secret/token enthält (ist_geheimer_schluessel), für Nutzer-Sitzungen
-- weder les- noch schreibbar. Der Server liest/schreibt sie mit Service-Role (src/lib/betrieb-geheimnisse.ts,
-- /api/betrieb-settings/save, /api/graph/*, E-Mail-Sync).

DROP POLICY IF EXISTS be_select ON public.betrieb_einstellungen;
DROP POLICY IF EXISTS be_insert ON public.betrieb_einstellungen;
DROP POLICY IF EXISTS be_update ON public.betrieb_einstellungen;
DROP POLICY IF EXISTS be_delete ON public.betrieb_einstellungen;

CREATE POLICY be_select ON public.betrieb_einstellungen FOR SELECT TO authenticated
  USING (public.ist_betriebsmitglied(betrieb_id) AND NOT public.ist_geheimer_schluessel(schluessel));

CREATE POLICY be_insert ON public.betrieb_einstellungen FOR INSERT TO authenticated
  WITH CHECK (public.ist_betriebsmitglied(betrieb_id) AND NOT public.ist_geheimer_schluessel(schluessel));

CREATE POLICY be_update ON public.betrieb_einstellungen FOR UPDATE TO authenticated
  USING (public.ist_betriebsmitglied(betrieb_id) AND NOT public.ist_geheimer_schluessel(schluessel))
  WITH CHECK (public.ist_betriebsmitglied(betrieb_id) AND NOT public.ist_geheimer_schluessel(schluessel));

CREATE POLICY be_delete ON public.betrieb_einstellungen FOR DELETE TO authenticated
  USING (public.ist_betriebsadmin(betrieb_id) AND NOT public.ist_geheimer_schluessel(schluessel));
