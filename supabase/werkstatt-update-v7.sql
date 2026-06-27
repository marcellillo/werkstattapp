-- werkstatt-update-v7.sql
-- Fehlende Spalten + Auftragsmappen / Foto-Dokumentation

-- Fehlende Spalten in fahrzeuge nachträglich anlegen
ALTER TABLE fahrzeuge ADD COLUMN IF NOT EXISTS tuev_erinnerung boolean DEFAULT false;
ALTER TABLE fahrzeuge ADD COLUMN IF NOT EXISTS naechster_service_datum date;

-- Fehlende Spalten in auftraege für Annahmeprotokoll
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS annahme_km integer;
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS annahme_tank integer; -- Prozent 0-100
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS annahme_schaeden text; -- Freitext: vorhandene Schäden
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS annahme_zustand text DEFAULT 'gut' CHECK (annahme_zustand IN ('sehr_gut','gut','maessig','schlecht'));
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS kostenrahmen_max numeric(10,2); -- max. Kostenrahmen KVA
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS annahme_unterschrift_kunde text; -- Base64 oder 'unterschrieben'
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS annahme_datum timestamptz;

-- Fotos pro Auftrag
CREATE TABLE IF NOT EXISTS auftrag_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid REFERENCES auftraege(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  url text NOT NULL,
  kategorie text DEFAULT 'allgemein' CHECK (kategorie IN ('annahme', 'reparatur', 'fertig', 'allgemein')),
  beschreibung text,
  erstellt_am timestamptz DEFAULT now()
);

ALTER TABLE auftrag_fotos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auftrag_fotos_authenticated" ON auftrag_fotos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage Bucket für Auftrag-Fotos (einmalig ausführen)
-- Falls der Bucket noch nicht existiert:
INSERT INTO storage.buckets (id, name, public)
VALUES ('auftrag-fotos', 'auftrag-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: authentifizierte Nutzer dürfen hochladen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'auftrag_fotos_upload'
  ) THEN
    CREATE POLICY "auftrag_fotos_upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'auftrag-fotos');

    CREATE POLICY "auftrag_fotos_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'auftrag-fotos');

    CREATE POLICY "auftrag_fotos_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'auftrag-fotos');
  END IF;
END $$;
