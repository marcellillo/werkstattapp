-- Update v6: Kunden-Rechnungen Tabelle (aus Auftraegen generiert)
CREATE TABLE IF NOT EXISTS kunden_rechnungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rechnungs_nr text UNIQUE NOT NULL,
  auftrag_id uuid REFERENCES auftraege(id) ON DELETE SET NULL,
  kunde_id uuid REFERENCES kunden(id) ON DELETE SET NULL,
  fahrzeug_id uuid REFERENCES fahrzeuge(id) ON DELETE SET NULL,
  betrag_netto numeric(10,2) DEFAULT 0,
  betrag_mwst numeric(10,2) DEFAULT 0,
  betrag_brutto numeric(10,2) DEFAULT 0,
  faellig_am date,
  status text DEFAULT 'offen' CHECK (status IN ('offen', 'bezahlt', 'storniert')),
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now()
);

ALTER TABLE kunden_rechnungen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users" ON kunden_rechnungen FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index fuer schnelle Abfragen nach Auftrag / Kunde
CREATE INDEX IF NOT EXISTS kunden_rechnungen_auftrag_id_idx ON kunden_rechnungen(auftrag_id);
CREATE INDEX IF NOT EXISTS kunden_rechnungen_kunde_id_idx ON kunden_rechnungen(kunde_id);
