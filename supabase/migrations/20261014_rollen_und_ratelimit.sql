-- SICHERHEIT: Rollen in der Datenbank durchsetzen + Rate-Limit-Tabelle (2026-10-08)
--
-- Bisher stand die Rollenverteilung (mechaniker darf keine Rechnungen/Einstellungen) nur in der Oberfläche.
-- Wer die App-API direkt aufrief, konnte als Mechaniker/Verkäufer z. B. die IBAN der Firma ändern,
-- Eingangsrechnungen auf "bezahlt" setzen oder Kunden löschen. Jetzt prüft auch die Datenbank die Rolle.
--
--  * Finanzrollen: admin, superadmin, buchhalter  (ist_finanzrolle)
--  * betrieb_einstellungen: schreiben nur Admins; normale Mitglieder nur die Teile-Update-Warteschlange
--  * rechnungen (Eingangsrechnungen): nur Finanzrollen
--  * kunden_rechnungen: ändern/löschen nur Finanzrollen (anlegen weiterhin alle Mitglieder: Rechnungs-Flow)
--  * kunden: löschen nur Admins (doppelte Alt-Regeln "kunden_*" entfernt, die jedem Mitglied das Löschen erlaubten)
--  * status_historie: Protokoll darf von Mitgliedern nur angelegt/gelesen, nicht geändert/gelöscht werden
--  * auftrag_lieferscheine: Alt-Regel las faktisch ALLE Zeilen für jeden eingeloggten Nutzer -> entfernt
--  * handle_new_user: Rolle aus den (vom Nutzer frei wählbaren) Anmelde-Metadaten wird nicht mehr übernommen
--  * Rate-Limit: Zähler-Tabelle + Funktion, nur für den Server (Service-Role) aufrufbar

-- ── 1) Rollen-Hilfsfunktionen ──
CREATE OR REPLACE FUNCTION public.ist_betriebsrolle(b uuid, rollen text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT b IS NOT NULL AND EXISTS (SELECT 1 FROM public.betrieb_users WHERE betrieb_id = b AND profile_id = auth.uid() AND role = ANY (rollen)) $$;

CREATE OR REPLACE FUNCTION public.ist_finanzrolle(b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.ist_betriebsrolle(b, ARRAY['admin','superadmin','buchhalter']) $$;

REVOKE EXECUTE ON FUNCTION public.ist_betriebsrolle(uuid, text[]), public.ist_finanzrolle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ist_betriebsrolle(uuid, text[]), public.ist_finanzrolle(uuid) TO authenticated, service_role;

-- ── 2) Einstellungen: nur Admins schreiben; Mitglieder nur die Teile-Update-Warteschlange ──
DROP POLICY IF EXISTS be_insert ON public.betrieb_einstellungen;
DROP POLICY IF EXISTS be_update ON public.betrieb_einstellungen;

CREATE POLICY be_insert ON public.betrieb_einstellungen FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.ist_geheimer_schluessel(schluessel)
    AND (public.ist_betriebsadmin(betrieb_id)
         OR (public.ist_betriebsmitglied(betrieb_id) AND schluessel = 'teile_updates_ausstehend'))
  );
CREATE POLICY be_update ON public.betrieb_einstellungen FOR UPDATE TO authenticated
  USING (
    NOT public.ist_geheimer_schluessel(schluessel)
    AND (public.ist_betriebsadmin(betrieb_id)
         OR (public.ist_betriebsmitglied(betrieb_id) AND schluessel = 'teile_updates_ausstehend'))
  )
  WITH CHECK (
    NOT public.ist_geheimer_schluessel(schluessel)
    AND (public.ist_betriebsadmin(betrieb_id)
         OR (public.ist_betriebsmitglied(betrieb_id) AND schluessel = 'teile_updates_ausstehend'))
  );

-- ── 3) Eingangsrechnungen: nur Finanzrollen ──
DROP POLICY IF EXISTS betrieb_select ON public.rechnungen;
DROP POLICY IF EXISTS betrieb_insert ON public.rechnungen;
DROP POLICY IF EXISTS betrieb_update ON public.rechnungen;
DROP POLICY IF EXISTS betrieb_delete ON public.rechnungen;
CREATE POLICY fin_select ON public.rechnungen FOR SELECT TO authenticated USING (public.ist_finanzrolle(betrieb_id));
CREATE POLICY fin_insert ON public.rechnungen FOR INSERT TO authenticated WITH CHECK (public.ist_finanzrolle(betrieb_id));
CREATE POLICY fin_update ON public.rechnungen FOR UPDATE TO authenticated
  USING (public.ist_finanzrolle(betrieb_id)) WITH CHECK (public.ist_finanzrolle(betrieb_id));
CREATE POLICY fin_delete ON public.rechnungen FOR DELETE TO authenticated USING (public.ist_finanzrolle(betrieb_id));

-- ── 4) Kundenrechnungen: ändern/löschen nur Finanzrollen ──
DROP POLICY IF EXISTS m_update ON public.kunden_rechnungen;
DROP POLICY IF EXISTS m_delete ON public.kunden_rechnungen;
CREATE POLICY fin_update ON public.kunden_rechnungen FOR UPDATE TO authenticated
  USING (public.ist_finanzrolle(betrieb_id)) WITH CHECK (public.ist_finanzrolle(betrieb_id));
CREATE POLICY fin_delete ON public.kunden_rechnungen FOR DELETE TO authenticated USING (public.ist_finanzrolle(betrieb_id));

-- ── 5) Kunden: Löschen nur Admins (die identischen Alt-Regeln kunden_* erlaubten es jedem Mitglied) ──
DROP POLICY IF EXISTS kunden_select ON public.kunden;
DROP POLICY IF EXISTS kunden_insert ON public.kunden;
DROP POLICY IF EXISTS kunden_update ON public.kunden;
DROP POLICY IF EXISTS kunden_delete ON public.kunden;

-- ── 6) Status-Protokoll: nur anlegen/lesen (Nachvollziehbarkeit) ──
DROP POLICY IF EXISTS betrieb_status_historie_all ON public.status_historie;

-- ── 7) Alt-Regel, die für jeden eingeloggten Nutzer alle Lieferscheine freigab ──
DROP POLICY IF EXISTS "Users can view their own delivery notes" ON public.auftrag_lieferscheine;
CREATE POLICY m_select ON public.auftrag_lieferscheine FOR SELECT TO authenticated USING (public.ist_betriebsmitglied(betrieb_id));

-- ── 8) Neue Konten: Rolle nie aus den frei wählbaren Anmelde-Metadaten übernehmen ──
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    left(COALESCE(new.raw_user_meta_data->>'full_name', ''), 200),
    'mechaniker'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ── 9) Rate-Limit (Festes Zeitfenster pro Schlüssel; nur der Server ruft die Funktion auf) ──
CREATE TABLE IF NOT EXISTS public.rate_limit_eintraege (
  schluessel   text        NOT NULL,
  fenster      timestamptz NOT NULL,
  anzahl       integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (schluessel, fenster)
);
ALTER TABLE public.rate_limit_eintraege ENABLE ROW LEVEL SECURITY;   -- keine Regel: kein Zugriff für Nutzer-Sitzungen
REVOKE ALL ON public.rate_limit_eintraege FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rate_limit_pruefen(p_schluessel text, p_max integer, p_fenster_sekunden integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_anzahl integer;
BEGIN
  IF p_fenster_sekunden < 1 THEN p_fenster_sekunden := 1; END IF;
  v_start := to_timestamp(floor(extract(epoch FROM now()) / p_fenster_sekunden) * p_fenster_sekunden);

  INSERT INTO public.rate_limit_eintraege AS r (schluessel, fenster, anzahl)
  VALUES (left(p_schluessel, 200), v_start, 1)
  ON CONFLICT (schluessel, fenster) DO UPDATE SET anzahl = r.anzahl + 1
  RETURNING r.anzahl INTO v_anzahl;

  -- gelegentlich Altlasten entfernen (hält die Tabelle klein, ohne Cron)
  IF random() < 0.02 THEN
    DELETE FROM public.rate_limit_eintraege WHERE fenster < now() - interval '2 days';
  END IF;

  RETURN v_anzahl <= p_max;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rate_limit_pruefen(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_pruefen(text, integer, integer) TO service_role;
