-- Leistungspakete ("Canned Jobs"): wiederkehrende Aufträge (Ölwechsel, Inspektion, Bremsen vorne …) einmal anlegen und
-- mit einem Klick in den Kostenvoranschlag (Teile) und Werkstattauftrag (Arbeitszeit) eines Auftrags übernehmen.
-- Lesen dürfen alle Mitarbeiter des Betriebs, anlegen/ändern/löschen nur Administratoren.

CREATE TABLE IF NOT EXISTS public.leistungspakete (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id    uuid NOT NULL REFERENCES public.betriebe(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  beschreibung  text CHECK (beschreibung IS NULL OR char_length(beschreibung) <= 500),
  erstellt_am   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leistungspaket_positionen (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id      uuid NOT NULL REFERENCES public.leistungspakete(id) ON DELETE CASCADE,
  betrieb_id    uuid NOT NULL REFERENCES public.betriebe(id) ON DELETE CASCADE,
  art           text NOT NULL CHECK (art IN ('teil', 'arbeit')),
  beschreibung  text NOT NULL CHECK (char_length(beschreibung) BETWEEN 1 AND 300),
  menge         numeric NOT NULL DEFAULT 1 CHECK (menge > 0 AND menge <= 10000),
  -- Teil: Preis je Stück (netto). Arbeit: Preis je Stunde; NULL = aktueller Stundensatz aus den Einstellungen
  einzelpreis   numeric CHECK (einzelpreis IS NULL OR (einzelpreis >= 0 AND einzelpreis <= 1000000)),
  sortierung    integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_leistungspakete_betrieb ON public.leistungspakete (betrieb_id);
CREATE INDEX IF NOT EXISTS idx_lp_positionen_paket ON public.leistungspaket_positionen (paket_id);

ALTER TABLE public.leistungspakete ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leistungspaket_positionen ENABLE ROW LEVEL SECURITY;

CREATE POLICY lp_select ON public.leistungspakete FOR SELECT TO authenticated USING (public.ist_betriebsmitglied(betrieb_id));
CREATE POLICY lp_insert ON public.leistungspakete FOR INSERT TO authenticated WITH CHECK (public.ist_betriebsadmin(betrieb_id));
CREATE POLICY lp_update ON public.leistungspakete FOR UPDATE TO authenticated
  USING (public.ist_betriebsadmin(betrieb_id)) WITH CHECK (public.ist_betriebsadmin(betrieb_id));
CREATE POLICY lp_delete ON public.leistungspakete FOR DELETE TO authenticated USING (public.ist_betriebsadmin(betrieb_id));

CREATE POLICY lpp_select ON public.leistungspaket_positionen FOR SELECT TO authenticated USING (public.ist_betriebsmitglied(betrieb_id));
-- Positionen müssen zum Paket DESSELBEN Betriebs gehören
CREATE POLICY lpp_insert ON public.leistungspaket_positionen FOR INSERT TO authenticated
  WITH CHECK (public.ist_betriebsadmin(betrieb_id)
    AND EXISTS (SELECT 1 FROM public.leistungspakete p WHERE p.id = paket_id AND p.betrieb_id = leistungspaket_positionen.betrieb_id));
CREATE POLICY lpp_update ON public.leistungspaket_positionen FOR UPDATE TO authenticated
  USING (public.ist_betriebsadmin(betrieb_id))
  WITH CHECK (public.ist_betriebsadmin(betrieb_id)
    AND EXISTS (SELECT 1 FROM public.leistungspakete p WHERE p.id = paket_id AND p.betrieb_id = leistungspaket_positionen.betrieb_id));
CREATE POLICY lpp_delete ON public.leistungspaket_positionen FOR DELETE TO authenticated USING (public.ist_betriebsadmin(betrieb_id));

REVOKE ALL ON public.leistungspakete, public.leistungspaket_positionen FROM anon;
