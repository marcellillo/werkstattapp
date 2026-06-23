-- ============================================================
-- Werkstatt Update v2
-- Ausführen im Supabase SQL Editor
-- ============================================================

-- Dialogannahme statt Bühne 4
UPDATE hebebuehnen SET bezeichnung = 'Dialogannahme', beschreibung = 'Fahrzeugannahme & Erstgespräch'
WHERE nummer = 4;

-- Eigene vs. Fremdfahrzeuge
ALTER TABLE fahrzeuge
  ADD COLUMN IF NOT EXISTS fahrzeug_typ text NOT NULL DEFAULT 'fremd'
  CHECK (fahrzeug_typ IN ('eigen', 'fremd'));

-- TÜV-Felder auf Aufträge
ALTER TABLE auftraege
  ADD COLUMN IF NOT EXISTS tuev_kandidat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tuev_termin date,
  ADD COLUMN IF NOT EXISTS tuev_ergebnis text
    CHECK (tuev_ergebnis IN ('bestanden', 'nicht_bestanden', 'maengel'));

-- Termine (Werkstatt + TÜV + Online-Buchungen)
CREATE TABLE IF NOT EXISTS termine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titel text NOT NULL,
  beschreibung text,
  datum date NOT NULL,
  uhrzeit time,
  dauer_minuten int DEFAULT 60,
  typ text NOT NULL DEFAULT 'werkstatt'
    CHECK (typ IN ('werkstatt', 'tuev', 'online')),
  status text NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen', 'bestaetigt', 'erledigt', 'abgesagt')),
  kunden_id uuid REFERENCES kunden(id) ON DELETE SET NULL,
  fahrzeug_id uuid REFERENCES fahrzeuge(id) ON DELETE SET NULL,
  auftrag_id uuid REFERENCES auftraege(id) ON DELETE SET NULL,
  notizen text,
  quelle text DEFAULT 'manuell',   -- 'manuell' | 'website' | 'telefon'
  extern_id text,                  -- ID aus externem Buchungssystem
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE termine ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON termine FOR ALL USING (auth.uid() IS NOT NULL);

-- Demo TÜV-Termin
INSERT INTO termine (titel, datum, uhrzeit, typ, status, notizen)
VALUES ('TÜV-Prüfer Besuch', CURRENT_DATE + interval '7 days', '09:00', 'tuev', 'bestaetigt', 'Hauptuntersuchung für 3 Fahrzeuge')
ON CONFLICT DO NOTHING;
