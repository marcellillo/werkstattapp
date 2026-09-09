-- Erweitert lieferschein_uploads um Auftrags-Bezug und Dokumenttyp, damit
-- Lieferscheine UND Rechnungen von Teilelieferanten auch einem konkreten
-- Auftrag (nicht nur einem Kostenvoranschlag) zugeordnet und in der
-- Auftragsmappe angezeigt werden können.
ALTER TABLE lieferschein_uploads ADD COLUMN IF NOT EXISTS auftrag_id UUID REFERENCES auftraege(id) ON DELETE CASCADE;
ALTER TABLE lieferschein_uploads ADD COLUMN IF NOT EXISTS dokument_typ TEXT NOT NULL DEFAULT 'lieferschein' CHECK (dokument_typ IN ('lieferschein', 'rechnung'));

CREATE INDEX IF NOT EXISTS idx_lieferschein_uploads_auftrag ON lieferschein_uploads(auftrag_id);
