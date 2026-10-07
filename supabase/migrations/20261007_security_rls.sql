-- SICHERHEIT: Zeilenschutz (RLS) lückenlos machen (2026-10-07)
--
-- Befunde vor dieser Migration:
--  * betrieb_einstellungen (API-Schlüssel, Microsoft-Secret, Tokens), betriebe, betrieb_users,
--    kostenvoranschlaege, werkstattauftraege u. a.: RLS war AUS -> für "anon" (öffentlicher
--    Schlüssel aus dem Browser) lesbar UND beschreibbar. (Sofortsperre: 20261006_...)
--  * profiles, hebebuehnen, werkstatt_einstellungen sowie auftrag_fotos, kunden_rechnungen,
--    kostenvoranschlag_position, werkstattauftrag_positionen: Regel "jeder eingeloggte Nutzer darf
--    ALLES" -> Betriebe konnten gegenseitig Daten lesen/ändern (z. B. fremde Profile ändern).
--  * betrieb_subscription / betrieb_payment_events: Mitglieder durften Abo-Zeilen ändern bzw.
--    Zahlungsereignisse einfügen.
--  * Alte, offen aufrufbare Datenbank-Funktionen (add_hebebuehne ...).
--  * Die Hebebühnen-Spalte betrieb_id fehlte live (Migration 20260910 war nie eingespielt).
--
-- Ergebnis: Jede Zeile gehört zu einem Betrieb; sichtbar/änderbar nur für dessen Mitglieder.
-- Schreibzugriffe auf Mitgliedschaften, Betriebe, Profile, Abos laufen ausschließlich über den
-- Server (Service-Role umgeht RLS). Alles in EINER Transaktion: ganz oder gar nicht.

-- ── 1) Hilfsfunktionen (SECURITY DEFINER: umgehen RLS in betrieb_users -> keine Rekursion) ──
CREATE OR REPLACE FUNCTION public.ist_betriebsmitglied(b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT b IS NOT NULL AND EXISTS (SELECT 1 FROM public.betrieb_users WHERE betrieb_id = b AND profile_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.ist_betriebsadmin(b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT b IS NOT NULL AND EXISTS (SELECT 1 FROM public.betrieb_users WHERE betrieb_id = b AND profile_id = auth.uid() AND role IN ('admin','superadmin')) $$;

CREATE OR REPLACE FUNCTION public.teilt_betrieb_mit(p uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.betrieb_users me JOIN public.betrieb_users o ON o.betrieb_id = me.betrieb_id
  WHERE me.profile_id = auth.uid() AND o.profile_id = p) $$;

-- Einstellungen mit Zugangsdaten: nur Admins dürfen sie ändern
CREATE OR REPLACE FUNCTION public.ist_geheimer_schluessel(k text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT k ~* '(api_key|password|secret|token)' $$;

-- ── 2) Hebebühnen: fehlende Betriebs-Zuordnung nachholen (4 vorhandene Zeilen -> Helios) ──
ALTER TABLE public.hebebuehnen ADD COLUMN IF NOT EXISTS betrieb_id uuid REFERENCES public.betriebe(id) ON DELETE CASCADE;
UPDATE public.hebebuehnen SET betrieb_id = (SELECT id FROM public.betriebe WHERE name = 'Helios Automobile GmbH') WHERE betrieb_id IS NULL;
ALTER TABLE public.hebebuehnen ALTER COLUMN betrieb_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hebebuehnen_betrieb ON public.hebebuehnen (betrieb_id);

-- ── 3) Alle bisherigen Regeln dieser Tabellen entfernen, RLS einschalten ──
DO $$
DECLARE t text; pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'betrieb_users','betriebe','betrieb_einstellungen','betrieb_subscription','betrieb_payment_events',
    'fahrzeug_rechnungen','kostenvoranschlaege','werkstattauftraege','arbeitszeiten',
    'kostenvoranschlag_positionen','rechnungs_positionen','auftrag_fotos','kostenvoranschlag_position',
    'werkstattauftrag_positionen','kunden_rechnungen','profiles','hebebuehnen','werkstatt_einstellungen',
    'website_kunden','website_leistungen_log','website_nachrichten','website_termine'
  ] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ── 4) Geschäftstabellen mit betrieb_id: Mitglieder dürfen lesen/anlegen/ändern/löschen ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fahrzeug_rechnungen','kostenvoranschlaege','werkstattauftraege','auftrag_fotos',
    'kostenvoranschlag_position','werkstattauftrag_positionen','kunden_rechnungen','hebebuehnen'
  ] LOOP
    EXECUTE format('CREATE POLICY m_select ON public.%I FOR SELECT TO authenticated USING (public.ist_betriebsmitglied(betrieb_id))', t);
    EXECUTE format('CREATE POLICY m_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.ist_betriebsmitglied(betrieb_id))', t);
    EXECUTE format('CREATE POLICY m_update ON public.%I FOR UPDATE TO authenticated USING (public.ist_betriebsmitglied(betrieb_id)) WITH CHECK (public.ist_betriebsmitglied(betrieb_id))', t);
    EXECUTE format('CREATE POLICY m_delete ON public.%I FOR DELETE TO authenticated USING (public.ist_betriebsmitglied(betrieb_id))', t);
  END LOOP;
END $$;

-- ── 5) Mitgliedschaften: lesen darf, wer im selben Betrieb ist; ändern nur der Server ──
CREATE POLICY bu_select ON public.betrieb_users FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.ist_betriebsmitglied(betrieb_id));
-- Einzige Selbstbedienung: den eigenen Haupt-Betrieb umschalten (nur die Spalte is_primary, nur eigene Zeilen)
CREATE POLICY bu_primary ON public.betrieb_users FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.betrieb_users FROM authenticated;
GRANT UPDATE (is_primary) ON public.betrieb_users TO authenticated;

-- ── 6) Betriebe: nur lesen (Stammdaten/Sperren ändert der Server) ──
CREATE POLICY b_select ON public.betriebe FOR SELECT TO authenticated USING (public.ist_betriebsmitglied(id));
REVOKE INSERT, UPDATE, DELETE ON public.betriebe FROM authenticated;

-- ── 7) Einstellungen: lesen Mitglieder; schreiben Mitglieder nur Unkritisches, Zugangsdaten nur Admins ──
CREATE POLICY be_select ON public.betrieb_einstellungen FOR SELECT TO authenticated
  USING (public.ist_betriebsmitglied(betrieb_id));
CREATE POLICY be_insert ON public.betrieb_einstellungen FOR INSERT TO authenticated
  WITH CHECK (public.ist_betriebsadmin(betrieb_id) OR (public.ist_betriebsmitglied(betrieb_id) AND NOT public.ist_geheimer_schluessel(schluessel)));
CREATE POLICY be_update ON public.betrieb_einstellungen FOR UPDATE TO authenticated
  USING (public.ist_betriebsadmin(betrieb_id) OR (public.ist_betriebsmitglied(betrieb_id) AND NOT public.ist_geheimer_schluessel(schluessel)))
  WITH CHECK (public.ist_betriebsadmin(betrieb_id) OR (public.ist_betriebsmitglied(betrieb_id) AND NOT public.ist_geheimer_schluessel(schluessel)));
CREATE POLICY be_delete ON public.betrieb_einstellungen FOR DELETE TO authenticated
  USING (public.ist_betriebsadmin(betrieb_id));

-- ── 8) Abo / Zahlungen: nur Admins sehen sie, geschrieben wird ausschließlich vom Server (Stripe-Webhook) ──
CREATE POLICY bs_select ON public.betrieb_subscription FOR SELECT TO authenticated USING (public.ist_betriebsadmin(betrieb_id));
CREATE POLICY bpe_select ON public.betrieb_payment_events FOR SELECT TO authenticated USING (public.ist_betriebsadmin(betrieb_id));
REVOKE INSERT, UPDATE, DELETE ON public.betrieb_subscription, public.betrieb_payment_events FROM authenticated;

-- ── 9) Profile: eigene und die von Kollegen im selben Betrieb lesen; schreiben nur der Server ──
CREATE POLICY p_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.teilt_betrieb_mit(id));
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;

-- ── 10) Ungenutzte/alte Tabellen: RLS an, keine Regel = nur Server-Zugriff ──
--   arbeitszeiten, kostenvoranschlag_positionen, rechnungs_positionen, werkstatt_einstellungen,
--   website_* (vom App-Code nicht benutzt)

-- ── 11) Datenbank-Funktionen: nichts mehr für Anonyme/öffentlich aufrufbar ──
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_hebebuehne(text, text) FROM authenticated;   -- veraltet, setzt kein betrieb_id
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ist_betriebsmitglied(uuid), public.ist_betriebsadmin(uuid),
  public.teilt_betrieb_mit(uuid), public.ist_geheimer_schluessel(text) TO authenticated, service_role;
ALTER FUNCTION public.add_hebebuehne(text, text) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- ── 12) Künftige Tabellen/Funktionen: Anonymen nichts mehr automatisch freigeben ──
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
