-- Fehlende Zeilenschutz-Regeln und fehlende Tabelle (2026-10-08)
--
-- Der Code löscht Ersatzteile und Termine und markiert Benachrichtigungen als gelesen -- dafür gab es keine
-- Regel, die Datenbank lehnte still ab (0 Zeilen, kein Fehler). Die Tabelle push_subscriptions (Push-Nachrichten
-- aufs Handy) existierte live gar nicht; die Vorlage push_subscriptions.sql im Repo hätte außerdem allen
-- Nutzern alle Abos gezeigt ("using true"). Hier: nur eigene Zeilen, Versand läuft über den Server.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions (user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ps_select ON public.push_subscriptions;
DROP POLICY IF EXISTS ps_delete ON public.push_subscriptions;
CREATE POLICY ps_select ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ps_delete ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());
-- Anlegen/Ändern (inkl. Gerätewechsel zwischen Konten) macht der Server

CREATE POLICY m_delete ON public.ersatzteile FOR DELETE TO authenticated
  USING (public.ist_betriebsmitglied(betrieb_id));
CREATE POLICY m_delete ON public.termine FOR DELETE TO authenticated
  USING (public.ist_betriebsmitglied(betrieb_id));
CREATE POLICY b_update_eigene ON public.benachrichtigungen FOR UPDATE TO authenticated
  USING (benutzer_id = auth.uid() AND public.ist_betriebsmitglied(betrieb_id))
  WITH CHECK (benutzer_id = auth.uid() AND public.ist_betriebsmitglied(betrieb_id));
