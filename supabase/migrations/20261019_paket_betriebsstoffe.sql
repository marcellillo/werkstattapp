-- Betriebsstoffe (Motoröl, Kühlmittel …) in Leistungspaketen: ein Paket wie "Ölwechsel komplett" enthält dann auch die Menge Öl.
-- Beim Hinzufügen des Pakets zu einem Auftrag landen die Mengen als Vorschlag am Auftrag (auftrag_betriebsstoffe);
-- der Rechnungs-Assistent belegt die Felder damit vor, berechnet wird weiterhin mit dem aktuellen Preis des Stoffes.

CREATE TABLE IF NOT EXISTS public.leistungspaket_betriebsstoffe (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id         uuid NOT NULL REFERENCES public.leistungspakete(id) ON DELETE CASCADE,
  betrieb_id       uuid NOT NULL REFERENCES public.betriebe(id) ON DELETE CASCADE,
  betriebsstoff_id uuid NOT NULL REFERENCES public.betriebsstoffe(id) ON DELETE CASCADE,
  menge            numeric NOT NULL CHECK (menge > 0 AND menge <= 1000),
  UNIQUE (paket_id, betriebsstoff_id)
);

CREATE TABLE IF NOT EXISTS public.auftrag_betriebsstoffe (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id       uuid NOT NULL REFERENCES public.auftraege(id) ON DELETE CASCADE,
  betrieb_id       uuid NOT NULL REFERENCES public.betriebe(id) ON DELETE CASCADE,
  betriebsstoff_id uuid NOT NULL REFERENCES public.betriebsstoffe(id) ON DELETE CASCADE,
  menge            numeric NOT NULL CHECK (menge > 0 AND menge <= 10000),
  quelle           text CHECK (quelle IS NULL OR char_length(quelle) <= 120),
  erstellt_am      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auftrag_id, betriebsstoff_id)
);

CREATE INDEX IF NOT EXISTS idx_lp_betriebsstoffe_paket ON public.leistungspaket_betriebsstoffe (paket_id);
CREATE INDEX IF NOT EXISTS idx_auftrag_betriebsstoffe_auftrag ON public.auftrag_betriebsstoffe (auftrag_id);

ALTER TABLE public.leistungspaket_betriebsstoffe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auftrag_betriebsstoffe ENABLE ROW LEVEL SECURITY;

-- Paket-Betriebsstoffe: lesen alle, ändern nur Admins; Paket und Stoff müssen zum selben Betrieb gehören
CREATE POLICY lpb_select ON public.leistungspaket_betriebsstoffe FOR SELECT TO authenticated USING (public.ist_betriebsmitglied(betrieb_id));
CREATE POLICY lpb_insert ON public.leistungspaket_betriebsstoffe FOR INSERT TO authenticated
  WITH CHECK (public.ist_betriebsadmin(betrieb_id)
    AND EXISTS (SELECT 1 FROM public.leistungspakete p WHERE p.id = paket_id AND p.betrieb_id = leistungspaket_betriebsstoffe.betrieb_id)
    AND EXISTS (SELECT 1 FROM public.betriebsstoffe s WHERE s.id = betriebsstoff_id AND s.betrieb_id = leistungspaket_betriebsstoffe.betrieb_id));
CREATE POLICY lpb_update ON public.leistungspaket_betriebsstoffe FOR UPDATE TO authenticated
  USING (public.ist_betriebsadmin(betrieb_id))
  WITH CHECK (public.ist_betriebsadmin(betrieb_id)
    AND EXISTS (SELECT 1 FROM public.leistungspakete p WHERE p.id = paket_id AND p.betrieb_id = leistungspaket_betriebsstoffe.betrieb_id)
    AND EXISTS (SELECT 1 FROM public.betriebsstoffe s WHERE s.id = betriebsstoff_id AND s.betrieb_id = leistungspaket_betriebsstoffe.betrieb_id));
CREATE POLICY lpb_delete ON public.leistungspaket_betriebsstoffe FOR DELETE TO authenticated USING (public.ist_betriebsadmin(betrieb_id));

-- Vorschläge am Auftrag: alle Mitarbeiter des Betriebs (jeder darf ein Paket hinzufügen); Auftrag und Stoff im selben Betrieb
CREATE POLICY ab_select ON public.auftrag_betriebsstoffe FOR SELECT TO authenticated USING (public.ist_betriebsmitglied(betrieb_id));
CREATE POLICY ab_insert ON public.auftrag_betriebsstoffe FOR INSERT TO authenticated
  WITH CHECK (public.ist_betriebsmitglied(betrieb_id)
    AND EXISTS (SELECT 1 FROM public.auftraege a WHERE a.id = auftrag_id AND a.betrieb_id = auftrag_betriebsstoffe.betrieb_id)
    AND EXISTS (SELECT 1 FROM public.betriebsstoffe s WHERE s.id = betriebsstoff_id AND s.betrieb_id = auftrag_betriebsstoffe.betrieb_id));
CREATE POLICY ab_update ON public.auftrag_betriebsstoffe FOR UPDATE TO authenticated
  USING (public.ist_betriebsmitglied(betrieb_id))
  WITH CHECK (public.ist_betriebsmitglied(betrieb_id)
    AND EXISTS (SELECT 1 FROM public.auftraege a WHERE a.id = auftrag_id AND a.betrieb_id = auftrag_betriebsstoffe.betrieb_id)
    AND EXISTS (SELECT 1 FROM public.betriebsstoffe s WHERE s.id = betriebsstoff_id AND s.betrieb_id = auftrag_betriebsstoffe.betrieb_id));
CREATE POLICY ab_delete ON public.auftrag_betriebsstoffe FOR DELETE TO authenticated USING (public.ist_betriebsmitglied(betrieb_id));

REVOKE ALL ON public.leistungspaket_betriebsstoffe, public.auftrag_betriebsstoffe FROM anon;
