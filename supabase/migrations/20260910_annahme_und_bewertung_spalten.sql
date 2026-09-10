-- Annahmeprotokoll: annahme-protokoll.tsx speichert seit Einfuehrung der
-- Schadenspunkt-Markierung und Checkliste in zwei Spalten, die nie angelegt
-- wurden. Dadurch scheiterte JEDES Speichern des Annahmeprotokolls (eine
-- einzelne UPDATE-Anweisung, komplett abgelehnt wegen der unbekannten
-- Spalten) -- auch die Felder, die es laengst gibt (annahme_km etc.) wurden
-- dadurch nie gespeichert.
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS annahme_schadenspunkte JSONB;
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS annahme_checkliste JSONB;

-- Bewertungen-Widget im Dashboard: dashboard-content.tsx zeigt bewertung_sterne
-- und bewertung_kommentar an, dashboard/page.tsx fragt zusaetzlich
-- bewertung_datum ab -- keine der drei Spalten existierte bisher.
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS bewertung_sterne INT CHECK (bewertung_sterne BETWEEN 1 AND 5);
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS bewertung_kommentar TEXT;
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS bewertung_datum TIMESTAMPTZ;
