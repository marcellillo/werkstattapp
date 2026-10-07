-- SICHERHEIT: Fotos und Lieferanten-Belege nicht mehr öffentlich per URL abrufbar (2026-10-07)
-- Die Buckets waren "public": wer die (zufällige, aber bekannte) URL hatte, konnte die Datei laden, ohne
-- Anmeldung. Jetzt privat; die App liefert sie über /api/auftrag-foto/datei und /api/beleg/datei aus
-- (Anmeldung + Betriebszugehörigkeit geprüft, dann kurzlebiger signierter Link).
UPDATE storage.buckets SET public = false WHERE id IN ('auftrag-fotos', 'supplier-invoice', 'supplier-invoices');
