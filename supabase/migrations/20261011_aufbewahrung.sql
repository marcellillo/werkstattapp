-- AUFBEWAHRUNG: Verkaufte und übergebene Fahrzeuge samt Auftragsmappe bleiben dauerhaft gespeichert
-- (Rückfragen, Gewährleistung, Steuer-/Buchführungspflichten) (2026-10-08)
--
-- Bisher löschte ein Löschklick auf ein Fahrzeug per ON DELETE CASCADE den Auftrag samt Fotos, Dokumenten,
-- Lieferscheinen, Teilen und Verläufen -- auch bei verkauften Fahrzeugen. Jetzt sperrt die Datenbank das selbst
-- (gilt für Oberfläche UND Schnittstellen). Nur der Server (Service-Role) / Datenbank-Verwalter darf noch aufräumen.
--
--  * Aufträge mit Status verkauft/ausgeliefert: nicht löschbar (blockiert auch das Löschen des Fahrzeugs, da es kaskadiert)
--  * Mappen-Inhalte (Fotos, Lieferscheine, Teile) solcher Aufträge: nur Administratoren dürfen einzelne Einträge entfernen
--  * Rechnungen: bezahlte Rechnungen und Rechnungen abgeschlossener Aufträge nur stornieren, nicht löschen;
--    Fahrzeug-Verkaufsrechnungen nie löschbar

CREATE OR REPLACE FUNCTION public.ist_serverzugriff() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT current_user IN ('postgres', 'supabase_admin', 'service_role') $$;

-- Aufträge selbst
CREATE OR REPLACE FUNCTION public.schuetze_auftrag_loeschen() RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF public.ist_serverzugriff() THEN RETURN OLD; END IF;
  IF OLD.status IN ('verkauft', 'ausgeliefert') THEN
    RAISE EXCEPTION 'AUFBEWAHRUNG: Verkaufte bzw. übergebene Fahrzeuge werden samt Auftragsmappe dauerhaft aufbewahrt und können nicht gelöscht werden.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_schuetze_auftrag_loeschen ON public.auftraege;
CREATE TRIGGER trg_schuetze_auftrag_loeschen BEFORE DELETE ON public.auftraege
  FOR EACH ROW EXECUTE FUNCTION public.schuetze_auftrag_loeschen();

-- Inhalte der Mappe (nur Administratoren dürfen bei abgeschlossenen Aufträgen noch einzelne Einträge entfernen)
CREATE OR REPLACE FUNCTION public.schuetze_mappeninhalt_loeschen() RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF public.ist_serverzugriff() THEN RETURN OLD; END IF;
  IF OLD.auftrag_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.auftraege a WHERE a.id = OLD.auftrag_id AND a.status IN ('verkauft', 'ausgeliefert'))
     AND NOT public.ist_betriebsadmin(OLD.betrieb_id) THEN
    RAISE EXCEPTION 'AUFBEWAHRUNG: Die Mappe verkaufter bzw. übergebener Fahrzeuge bleibt erhalten – einzelne Einträge kann nur ein Administrator entfernen.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_schuetze_mappe_fotos ON public.auftrag_fotos;
CREATE TRIGGER trg_schuetze_mappe_fotos BEFORE DELETE ON public.auftrag_fotos
  FOR EACH ROW EXECUTE FUNCTION public.schuetze_mappeninhalt_loeschen();
DROP TRIGGER IF EXISTS trg_schuetze_mappe_lieferscheine ON public.lieferschein_uploads;
CREATE TRIGGER trg_schuetze_mappe_lieferscheine BEFORE DELETE ON public.lieferschein_uploads
  FOR EACH ROW EXECUTE FUNCTION public.schuetze_mappeninhalt_loeschen();
DROP TRIGGER IF EXISTS trg_schuetze_mappe_teile ON public.ersatzteile;
CREATE TRIGGER trg_schuetze_mappe_teile BEFORE DELETE ON public.ersatzteile
  FOR EACH ROW EXECUTE FUNCTION public.schuetze_mappeninhalt_loeschen();

-- Rechnungen an Kunden
CREATE OR REPLACE FUNCTION public.schuetze_rechnung_loeschen() RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF public.ist_serverzugriff() THEN RETURN OLD; END IF;
  IF OLD.status = 'bezahlt' THEN
    RAISE EXCEPTION 'AUFBEWAHRUNG: Bezahlte Rechnungen dürfen nicht gelöscht werden (gesetzliche Aufbewahrungspflicht). Bitte bei Bedarf stornieren.';
  END IF;
  IF OLD.auftrag_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.auftraege a WHERE a.id = OLD.auftrag_id AND a.status IN ('verkauft', 'ausgeliefert')) THEN
    RAISE EXCEPTION 'AUFBEWAHRUNG: Rechnungen verkaufter bzw. übergebener Fahrzeuge dürfen nicht gelöscht werden. Bitte stattdessen stornieren.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_schuetze_rechnung ON public.kunden_rechnungen;
CREATE TRIGGER trg_schuetze_rechnung BEFORE DELETE ON public.kunden_rechnungen
  FOR EACH ROW EXECUTE FUNCTION public.schuetze_rechnung_loeschen();

-- Fahrzeug-Verkaufsrechnungen: nie löschbar
CREATE OR REPLACE FUNCTION public.schuetze_fahrzeugrechnung_loeschen() RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF public.ist_serverzugriff() THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'AUFBEWAHRUNG: Verkaufsrechnungen für Fahrzeuge dürfen nicht gelöscht werden (gesetzliche Aufbewahrungspflicht).';
END $$;

DROP TRIGGER IF EXISTS trg_schuetze_fahrzeugrechnung ON public.fahrzeug_rechnungen;
CREATE TRIGGER trg_schuetze_fahrzeugrechnung BEFORE DELETE ON public.fahrzeug_rechnungen
  FOR EACH ROW EXECUTE FUNCTION public.schuetze_fahrzeugrechnung_loeschen();

-- Die Trigger-Funktionen sollen nicht per RPC aufrufbar sein (beim Auslösen der Trigger wird das Recht nicht geprüft).
-- ist_serverzugriff() wird INNERHALB der Trigger mit den Rechten des Nutzers aufgerufen und bleibt für Eingeloggte erlaubt.
REVOKE EXECUTE ON FUNCTION public.schuetze_auftrag_loeschen(), public.schuetze_mappeninhalt_loeschen(),
  public.schuetze_rechnung_loeschen(), public.schuetze_fahrzeugrechnung_loeschen() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ist_serverzugriff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ist_serverzugriff() TO authenticated, service_role;
