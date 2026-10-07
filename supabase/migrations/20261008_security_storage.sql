-- SICHERHEIT: Datei-Speicher (Storage) (2026-10-07)
--
-- Befunde:
--  * "Allow uploads 1yyveb0_0": INSERT für ALLE (auch Anonyme) in JEDEN Bucket (WITH CHECK true).
--  * Bucket "fahrzeugbrief" (Fahrzeugschein-/Fahrzeugbrief-Fotos mit Namen/Adressen): Regeln für
--    "anon" erlaubten anonymes Hochladen und Lesen/Auflisten. (Der Server nutzt hier ohnehin den
--    Service-Role-Schlüssel; die Regeln waren überflüssig.) Dasselbe für den gar nicht
--    existierenden Bucket "fahrzeugbriefe".
--  * "auftrag-fotos": jeder eingeloggte Nutzer JEDES Betriebs durfte Fotos lesen/löschen/hochladen.
--
-- Danach: Anonyme haben keinen Zugriff auf Storage-Objekte; Fotos nur für Mitglieder des Betriebs,
-- zu dem der Auftrag gehört; Lieferanten-Belege nur Upload durch eingeloggte Nutzer.

DROP POLICY IF EXISTS "Allow uploads 1yyveb0_0" ON storage.objects;
DROP POLICY IF EXISTS fahrzeugbrief_insert  ON storage.objects;
DROP POLICY IF EXISTS fahrzeugbrief_select  ON storage.objects;
DROP POLICY IF EXISTS fahrzeugbriefe_insert ON storage.objects;
DROP POLICY IF EXISTS fahrzeugbriefe_select ON storage.objects;

-- Lieferanten-Belege / Lieferscheine (öffentliche Buckets, Lesen per URL): Upload nur eingeloggt
CREATE POLICY supplier_belege_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('supplier-invoice', 'supplier-invoices'));

-- Auftragsfotos: der Pfad enthält die Auftrags-ID als 1. ("<auftrag>/<kategorie>/...")
-- oder 2. Teil ("annahme/<auftrag>/..."); der Auftrag muss zum eigenen Betrieb gehören.
DROP POLICY IF EXISTS auftrag_fotos_read   ON storage.objects;
DROP POLICY IF EXISTS auftrag_fotos_upload ON storage.objects;
DROP POLICY IF EXISTS auftrag_fotos_delete ON storage.objects;

CREATE POLICY auftrag_fotos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'auftrag-fotos' AND EXISTS (
    SELECT 1 FROM public.auftraege a
    WHERE a.id::text IN (split_part(name, '/', 1), split_part(name, '/', 2)) AND public.ist_betriebsmitglied(a.betrieb_id)));
CREATE POLICY auftrag_fotos_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'auftrag-fotos' AND EXISTS (
    SELECT 1 FROM public.auftraege a
    WHERE a.id::text IN (split_part(name, '/', 1), split_part(name, '/', 2)) AND public.ist_betriebsmitglied(a.betrieb_id)));
CREATE POLICY auftrag_fotos_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'auftrag-fotos' AND EXISTS (
    SELECT 1 FROM public.auftraege a
    WHERE a.id::text IN (split_part(name, '/', 1), split_part(name, '/', 2)) AND public.ist_betriebsmitglied(a.betrieb_id)));
