-- Privater Bucket für Exporte (Steuerberater-Paket, Datensicherung) als ZIP. Nur Server-Zugriff; Auslieferung über
-- kurzlebige signierte Links nach Rollen-Prüfung. Alte Exporte werden beim nächsten Export (nach 24 Stunden) gelöscht.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exporte', 'exporte', false, 52428800, ARRAY['application/zip'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800, allowed_mime_types = ARRAY['application/zip'];
