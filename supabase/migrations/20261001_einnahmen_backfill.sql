-- Einmaliger Backfill: auftraege.einnahmen war für Werkstattaufträge nie
-- automatisch gesetzt worden (der Rechnungs-Flow schrieb nur in
-- kunden_rechnungen, nie zurück in auftraege.einnahmen). Ab jetzt hält
-- syncAuftragEinnahmen() (src/lib/auftrag-einnahmen.ts) das synchron --
-- dieser Backfill holt bereits bestehende Rechnungen nach. Betrifft nur
-- Aufträge, die tatsächlich Rechnungen haben; Eigenfahrzeug-Einnahmen
-- (manuell beim Verkauf gesetzt, keine kunden_rechnungen-Zeile) bleiben
-- unangetastet, da der JOIN für sie nicht matcht.
UPDATE auftraege a
SET einnahmen = sub.summe
FROM (
  SELECT auftrag_id, SUM(betrag_brutto) AS summe
  FROM kunden_rechnungen
  WHERE status != 'storniert' AND auftrag_id IS NOT NULL
  GROUP BY auftrag_id
) sub
WHERE a.id = sub.auftrag_id
  AND sub.summe > 0;
