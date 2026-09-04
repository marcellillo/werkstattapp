-- Verknüpft Kunden-Rechnungen mit dem Kostenvoranschlag und Werkstattauftrag,
-- aus denen sie erstellt wurden (Werkstatt-Rechnungen: Arbeitszeit + Ersatzteile)
ALTER TABLE kunden_rechnungen
  ADD COLUMN IF NOT EXISTS kostenvoranschlag_id UUID REFERENCES kostenvoranschlaege(id) ON DELETE SET NULL;

ALTER TABLE kunden_rechnungen
  ADD COLUMN IF NOT EXISTS werkstattauftrag_id UUID REFERENCES werkstattauftraege(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kunden_rechnungen_kostenvoranschlag
  ON kunden_rechnungen(kostenvoranschlag_id);
CREATE INDEX IF NOT EXISTS idx_kunden_rechnungen_werkstattauftrag
  ON kunden_rechnungen(werkstattauftrag_id);
