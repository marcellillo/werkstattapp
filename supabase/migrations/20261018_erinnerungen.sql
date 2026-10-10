-- Erinnerungsprotokoll: wer wurde wann und auf welchem Weg an eine Zahlung, die HU oder den Service erinnert?
-- Damit niemand doppelt angeschrieben wird und man sieht, wer schon "dran war" (Vorbild: Erinnerungsprotokoll je Fahrzeug).
-- Lesen dürfen alle Mitarbeiter des Betriebs, Zahlungs-Erinnerungen nur Finanzrollen.

CREATE TABLE IF NOT EXISTS public.kunden_erinnerungen (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id   uuid NOT NULL REFERENCES public.betriebe(id) ON DELETE CASCADE,
  art          text NOT NULL CHECK (art IN ('zahlung', 'hu', 'service')),
  -- zahlung: kunden_rechnungen.id · hu/service: fahrzeuge.id
  bezug_id     uuid NOT NULL,
  kunde_id     uuid REFERENCES public.kunden(id) ON DELETE SET NULL,
  kanal        text NOT NULL CHECK (kanal IN ('whatsapp', 'telefon', 'email', 'sms')),
  erstellt_am  timestamptz NOT NULL DEFAULT now(),
  erstellt_von uuid DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_kunden_erinnerungen_bezug ON public.kunden_erinnerungen (betrieb_id, art, bezug_id, erstellt_am DESC);

ALTER TABLE public.kunden_erinnerungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY erinnerungen_select ON public.kunden_erinnerungen FOR SELECT TO authenticated
  USING (public.ist_betriebsmitglied(betrieb_id) AND (art <> 'zahlung' OR public.ist_finanzrolle(betrieb_id)));
CREATE POLICY erinnerungen_insert ON public.kunden_erinnerungen FOR INSERT TO authenticated
  WITH CHECK (public.ist_betriebsmitglied(betrieb_id) AND (art <> 'zahlung' OR public.ist_finanzrolle(betrieb_id))
    AND (erstellt_von IS NULL OR erstellt_von = auth.uid()));
CREATE POLICY erinnerungen_delete ON public.kunden_erinnerungen FOR DELETE TO authenticated
  USING (public.ist_betriebsadmin(betrieb_id));

REVOKE ALL ON public.kunden_erinnerungen FROM anon;
