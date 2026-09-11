-- Einmalige Bereinigung: entfernt die 144 Fahrzeuge, die durch wiederholte,
-- fehlerhafte CSV-Importe (Mapping-Bug, unabhaengig vom Delimiter-Fix) als
-- Platzhalter angelegt wurden -- erkennbar an Kennzeichen im Muster
-- "FZ-NNNNN" (automatisch generiert statt aus der CSV gelesen) und fehlender
-- mobile_de_id. Betroffen sind ausschliesslich Importe vom 2026-09-10 und
-- 2026-09-11; die 31 echten Fahrzeuge aus dem urspruenglichen Mobile.de-Import
-- vom 2026-07-21 (mit echten Kennzeichen wie "B-28") bleiben unberuehrt.
--
-- Vorab geprueft (Stand vor dieser Migration): alle 144 zugehoerigen
-- Auftraege stehen unveraendert auf Status 'angenommen' und haben keine
-- Ersatzteile, Fotos, Rechnungen, Lieferscheine oder Verlaufseintraege --
-- die Loeschung ist damit ohne Kollateralschaden.

DO $$
DECLARE
  helios_id UUID := '1b500e76-081d-48c6-a17c-d777f4d6a4ab';
  fahrzeug_ids UUID[];
  auftrag_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO fahrzeug_ids
  FROM fahrzeuge
  WHERE betrieb_id = helios_id AND kennzeichen ~ '^FZ-\d+$';

  SELECT array_agg(id) INTO auftrag_ids
  FROM auftraege
  WHERE fahrzeug_id = ANY(fahrzeug_ids);

  RAISE NOTICE 'Fahrzeuge zum Loeschen: %', COALESCE(array_length(fahrzeug_ids, 1), 0);
  RAISE NOTICE 'Auftraege zum Loeschen: %', COALESCE(array_length(auftrag_ids, 1), 0);

  -- Sicherheitsnetz: falls irgendein betroffener Auftrag NICHT mehr auf
  -- 'angenommen' steht (d.h. jemand hat inzwischen daran gearbeitet),
  -- bricht die Migration ab statt Daten zu verlieren.
  IF EXISTS (
    SELECT 1 FROM auftraege WHERE id = ANY(auftrag_ids) AND status <> 'angenommen'
  ) THEN
    RAISE EXCEPTION 'Abbruch: mindestens ein betroffener Auftrag hat einen anderen Status als "angenommen" -- bitte manuell pruefen.';
  END IF;

  DELETE FROM auftraege WHERE id = ANY(auftrag_ids);
  DELETE FROM fahrzeuge WHERE id = ANY(fahrzeug_ids);
END $$;
