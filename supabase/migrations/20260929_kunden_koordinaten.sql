-- Speichert die geokodierten Koordinaten der Kundenanschrift, damit die
-- Kunden-Karte nicht bei jedem Aufruf erneut geokodieren muss.
ALTER TABLE kunden ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE kunden ADD COLUMN IF NOT EXISTS lng double precision;
