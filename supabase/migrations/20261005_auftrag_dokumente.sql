-- Dokumente & Dateien je Auftrag/Fahrzeug (CarVertical-Bericht, Gutachten, Fahrzeugbrief,
-- Verträge, ...): PDF oder Bild, in der Auftragsmappe sichtbar.
-- Privater Bucket (enthält personenbezogene Daten) -- Zugriff nur über die API
-- (Mitgliedschaftsprüfung, dann kurzlebiger signierter Link). Schreiben ebenfalls nur über
-- die API (Service-Role), Lesen der Zeilen per RLS für Betriebsmitglieder.

CREATE TABLE IF NOT EXISTS auftrag_dokumente (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id   uuid NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  auftrag_id   uuid NOT NULL REFERENCES auftraege(id) ON DELETE CASCADE,
  kategorie    text NOT NULL DEFAULT 'sonstiges'
               CHECK (kategorie IN ('carvertical','fahrzeugschein','fahrzeugbrief','tuev','gutachten','vertrag','rechnung','sonstiges')),
  titel        text,
  datei_pfad   text NOT NULL,
  datei_name   text NOT NULL,
  datei_typ    text NOT NULL,
  groesse      bigint,
  erstellt_von uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  erstellt_am  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auftrag_dokumente_auftrag ON auftrag_dokumente (auftrag_id);
CREATE INDEX IF NOT EXISTS idx_auftrag_dokumente_betrieb ON auftrag_dokumente (betrieb_id);

ALTER TABLE auftrag_dokumente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "betrieb_select" ON auftrag_dokumente;
CREATE POLICY "betrieb_select" ON auftrag_dokumente FOR SELECT
  TO authenticated
  USING (betrieb_id IN (SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'auftrag-dokumente', 'auftrag-dokumente', false, 26214400,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;
