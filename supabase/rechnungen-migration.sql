-- Lieferantenrechnungen
CREATE TABLE IF NOT EXISTS rechnungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lieferant text,
  rechnungsnummer text,
  datum date,
  gesamt numeric(10,2),
  datei_url text,
  notizen text,
  erstellt_am timestamptz DEFAULT now()
);

-- Positionen der Rechnung (vom Claude API extrahiert)
CREATE TABLE IF NOT EXISTS rechnung_positionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rechnung_id uuid REFERENCES rechnungen(id) ON DELETE CASCADE,
  bezeichnung text NOT NULL,
  teilenummer text,
  menge numeric(10,2) DEFAULT 1,
  einzelpreis numeric(10,2),
  gesamtpreis numeric(10,2)
);

-- RLS
ALTER TABLE rechnungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE rechnung_positionen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users" ON rechnungen FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users" ON rechnung_positionen FOR ALL TO authenticated USING (true) WITH CHECK (true);
