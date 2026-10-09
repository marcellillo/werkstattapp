-- Freigabe des Kostenvoranschlags durch den Kunden per Link (ohne Anmeldung).
-- Das geheime Token liegt in einer EIGENEN Tabelle ohne jede Regel für Nutzer-Sitzungen: nur der Server (Service-Role)
-- kann es lesen oder schreiben. Öffentliche Seite/API arbeiten ausschließlich serverseitig; es gibt keine Regel für anon.
-- Der Status bleibt im bestehenden Check (entwurf | gesendet | akzeptiert | abgelehnt); "akzeptiert" = vom Kunden freigegeben.

CREATE TABLE IF NOT EXISTS public.kva_freigabe_tokens (
  kva_id      uuid PRIMARY KEY REFERENCES public.kostenvoranschlaege(id) ON DELETE CASCADE,
  betrieb_id  uuid NOT NULL REFERENCES public.betriebe(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{64}$'),
  erstellt_am timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kva_freigabe_tokens ENABLE ROW LEVEL SECURITY;      -- keine Regel = nur Service-Role
REVOKE ALL ON public.kva_freigabe_tokens FROM PUBLIC, anon, authenticated;

-- Sichtbar für die Werkstatt (normale Mitarbeiter-Regeln der Tabelle): wann gesendet, wer/wann/über welchen Betrag freigegeben
ALTER TABLE public.kostenvoranschlaege
  ADD COLUMN IF NOT EXISTS freigabe_gesendet_am  timestamptz,
  ADD COLUMN IF NOT EXISTS freigegeben_am        timestamptz,
  ADD COLUMN IF NOT EXISTS freigegeben_name      text,
  ADD COLUMN IF NOT EXISTS freigegeben_betrag    numeric,
  ADD COLUMN IF NOT EXISTS freigabe_hinweis      text;
