-- Verknüpft Kostenvoranschlag und Werkstattauftrag mit dem konkreten Auftrag (Besuch/Vorgang),
-- nicht nur mit dem Fahrzeug. Verhindert, dass bei mehreren Werkstattbesuchen desselben Fahrzeugs
-- alte Kostenvoranschläge/Werkstattaufträge in einen neuen Vorgang hineinrutschen.
ALTER TABLE kostenvoranschlaege
  ADD COLUMN IF NOT EXISTS auftrag_id UUID REFERENCES auftraege(id) ON DELETE SET NULL;

ALTER TABLE werkstattauftraege
  ADD COLUMN IF NOT EXISTS auftrag_id UUID REFERENCES auftraege(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kostenvoranschlaege_auftrag ON kostenvoranschlaege(auftrag_id);
CREATE INDEX IF NOT EXISTS idx_werkstattauftraege_auftrag ON werkstattauftraege(auftrag_id);

-- Markiert, in welcher Rechnung ein Kostenvoranschlag/Werkstattauftrag bereits abgerechnet wurde.
-- Verhindert, dass bei einer zweiten Rechnung für denselben Auftrag (z.B. Kunde kommt erneut)
-- bereits bezahlte/abgerechnete Positionen versehentlich nochmal mitgerechnet werden.
ALTER TABLE kostenvoranschlaege
  ADD COLUMN IF NOT EXISTS rechnung_id UUID REFERENCES kunden_rechnungen(id) ON DELETE SET NULL;

ALTER TABLE werkstattauftraege
  ADD COLUMN IF NOT EXISTS rechnung_id UUID REFERENCES kunden_rechnungen(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kostenvoranschlaege_rechnung ON kostenvoranschlaege(rechnung_id);
CREATE INDEX IF NOT EXISTS idx_werkstattauftraege_rechnung ON werkstattauftraege(rechnung_id);

-- Optionale Zusatzposten, die nicht aus Kostenvoranschlag/Werkstattauftrag stammen
-- (z.B. Kleinteilpauschale, Entsorgungsgebühr) — für die "System B" Rechnungsansicht.
ALTER TABLE kunden_rechnungen ADD COLUMN IF NOT EXISTS kleinteilpauschale_betrag NUMERIC(10,2);
ALTER TABLE kunden_rechnungen ADD COLUMN IF NOT EXISTS sonstiges_beschreibung TEXT;
ALTER TABLE kunden_rechnungen ADD COLUMN IF NOT EXISTS sonstiges_betrag NUMERIC(10,2);

-- werkstattauftraege hatte nie eine Nummern-Spalte (wurde aber im PDF/Filename schon referenziert)
ALTER TABLE werkstattauftraege ADD COLUMN IF NOT EXISTS nummer TEXT;
