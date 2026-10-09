-- Privater Bucket für die Komplett-PDF der Auftragsmappe (erzeugt von /api/mappe/komplett-pdf, nur Server-Zugriff).
-- Keine Storage-Regeln für Nutzer: Auslieferung ausschließlich über kurzlebige signierte Links nach Betriebs-Prüfung.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('auftrag-mappen', 'auftrag-mappen', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800, allowed_mime_types = ARRAY['application/pdf'];
