-- Arbeitszeit je Auftrag: Mitarbeiter stempeln "Arbeit starten/stoppen" am Auftrag (oder tragen Zeit nach).
-- Auswertung: gestempelte Stunden gegen abgerechnete Arbeitsstunden (Effizienz) in den Statistiken.
-- Lesen alle Mitarbeiter des Betriebs (für "wer arbeitet gerade"); schreiben Admins und Mechaniker nur für sich selbst,
-- Admins dürfen Zeiten aller korrigieren.

CREATE TABLE IF NOT EXISTS public.auftrag_zeiten (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id   uuid NOT NULL REFERENCES public.betriebe(id) ON DELETE CASCADE,
  auftrag_id   uuid NOT NULL REFERENCES public.auftraege(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_am     timestamptz NOT NULL DEFAULT now(),
  ende_am      timestamptz,
  manuell      boolean NOT NULL DEFAULT false,
  notiz        text CHECK (notiz IS NULL OR char_length(notiz) <= 200),
  erstellt_am  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auftrag_zeiten_ende_nach_start CHECK (ende_am IS NULL OR ende_am >= start_am),
  CONSTRAINT auftrag_zeiten_max_24h CHECK (ende_am IS NULL OR ende_am - start_am <= interval '24 hours')
);

-- Pro Mitarbeiter höchstens EINE laufende Zeit (verhindert doppeltes Stempeln, auch bei zwei Geräten)
CREATE UNIQUE INDEX IF NOT EXISTS idx_auftrag_zeiten_eine_laufende ON public.auftrag_zeiten (betrieb_id, user_id) WHERE ende_am IS NULL;
CREATE INDEX IF NOT EXISTS idx_auftrag_zeiten_auftrag ON public.auftrag_zeiten (auftrag_id);
CREATE INDEX IF NOT EXISTS idx_auftrag_zeiten_betrieb_start ON public.auftrag_zeiten (betrieb_id, start_am DESC);

ALTER TABLE public.auftrag_zeiten ENABLE ROW LEVEL SECURITY;

CREATE POLICY zeiten_select ON public.auftrag_zeiten FOR SELECT TO authenticated USING (public.ist_betriebsmitglied(betrieb_id));

-- Anlegen: Admin/Mechaniker, für sich selbst, am Auftrag des eigenen Betriebs (Admins auch für andere Mitarbeiter ihres Betriebs)
CREATE POLICY zeiten_insert ON public.auftrag_zeiten FOR INSERT TO authenticated
  WITH CHECK (
    public.ist_betriebsrolle(betrieb_id, ARRAY['admin','superadmin','mechaniker'])
    AND (user_id = auth.uid() OR public.ist_betriebsadmin(betrieb_id))
    AND EXISTS (SELECT 1 FROM public.auftraege a WHERE a.id = auftrag_id AND a.betrieb_id = auftrag_zeiten.betrieb_id)
  );

-- Ändern: die eigene LAUFENDE Zeit stoppen; Admins dürfen jede Zeit korrigieren
CREATE POLICY zeiten_update ON public.auftrag_zeiten FOR UPDATE TO authenticated
  USING ((user_id = auth.uid() AND ende_am IS NULL AND public.ist_betriebsmitglied(betrieb_id)) OR public.ist_betriebsadmin(betrieb_id))
  WITH CHECK ((user_id = auth.uid() AND public.ist_betriebsmitglied(betrieb_id)) OR public.ist_betriebsadmin(betrieb_id));

-- Löschen: eigene Zeiten und Admins
CREATE POLICY zeiten_delete ON public.auftrag_zeiten FOR DELETE TO authenticated
  USING ((user_id = auth.uid() AND public.ist_betriebsmitglied(betrieb_id)) OR public.ist_betriebsadmin(betrieb_id));

REVOKE ALL ON public.auftrag_zeiten FROM anon;
