-- Betriebsstoffe je Sorte statt einem Sammel-Eintrag "Motoröl" (nur Helios Automobile GmbH).
-- Der vorhandene Eintrag "Motoröl" (inkl. der gebuchten 45 L, Bemerkung "5W30") wird zu
-- "Motoröl 5W-30" umbenannt -- dadurch bleiben Bestand und Verlauf erhalten.
-- Verkaufspreis Öl: 26,00 €/L netto. Bremsflüssigkeit, Kühlwasser, Bremsreiniger: Preis noch
-- offen (0 = "Preis fehlt", wird auf Rechnungen nicht angeboten, bis er eingetragen ist).
DO $$
DECLARE b uuid;
BEGIN
  SELECT id INTO b FROM betriebe WHERE name = 'Helios Automobile GmbH';
  IF b IS NULL THEN RETURN; END IF;

  UPDATE betriebsstoffe SET name = 'Motoröl 5W-30', sortierung = 1
   WHERE betrieb_id = b AND name = 'Motoröl';

  INSERT INTO betriebsstoffe (betrieb_id, name, einheit, preis_pro_einheit, sortierung) VALUES
    (b, 'Motoröl 5W-30',   'L', 26.00, 1),
    (b, 'Motoröl 0W-30',   'L', 26.00, 2),
    (b, 'Motoröl 5W-40',   'L', 26.00, 3),
    (b, 'Motoröl 10W-40',  'L', 26.00, 4),
    (b, 'Bremsflüssigkeit','L',  0.00, 5),
    (b, 'Wischwasser',     'L',  8.00, 6),
    (b, 'Kühlwasser',      'L',  0.00, 7),
    (b, 'Bremsreiniger',   'L',  0.00, 8)
  ON CONFLICT (betrieb_id, name) DO NOTHING;

  UPDATE betriebsstoffe SET sortierung = 6 WHERE betrieb_id = b AND name = 'Wischwasser';
END $$;
