-- Fotos können für den Kunden freigegeben werden: nur diese erscheinen auf der öffentlichen Freigabe-Seite des
-- Kostenvoranschlags ("Das haben wir gefunden"). Standard: nicht sichtbar.
ALTER TABLE public.auftrag_fotos ADD COLUMN IF NOT EXISTS fuer_kunde boolean NOT NULL DEFAULT false;
