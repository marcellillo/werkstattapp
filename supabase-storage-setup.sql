-- SUPABASE STORAGE SETUP FÜR LIEFERSCHEINE
-- Diese Datei dokumentiert die notwendigen Schritte im Supabase-Dashboard

========================================
SCHRITT 1: BUCKET ERSTELLEN
========================================

Gehe zu: https://supabase.com/dashboard/project/[dein-projekt]/storage/buckets

1. Klicke "Create a new bucket"
2. Name: "lieferscheine"
3. Wähle "Public bucket" (✓ öffentlicher Zugriff)
4. Klicke "Create bucket"

========================================
SCHRITT 2: RLS-POLICIES KONFIGURIEREN
========================================

Nach dem Erstellen des Buckets:

1. Klicke im Bucket auf "Policies" (rechts oben)
2. Wähle "New Policy"
3. Wähle "INSERT" und klicke "Create policy"

Im Dialog:
- Policy template: "Authenticated users can upload"
- Zeile 2, nach "WITH CHECK" ersetze die Bedingung mit:

  bucket_id = 'lieferscheine'

4. Klicke "Review" dann "Save policy"

Wiederhole Schritte 2-4 für "SELECT":
- Policy template: "Users can view"
- Bedingung: bucket_id = 'lieferscheine'

Wiederhole nochmal für "DELETE":
- Policy template: "Users can delete"
- Bedingung: bucket_id = 'lieferscheine'

========================================
SCHRITT 3: DATEIBROWSER ÜBERPRÜFEN
========================================

Klicke auf den "lieferscheine" Bucket.
Es sollte leer sein, aber kein "Access Denied" Error.

Falls "Access Denied" → Policies waren nicht erfolgreich gespeichert.
Versuche erneut von oben, oder kontaktiere Supabase Support.

========================================
ALTERNATIV (FALLBACK): BUCKET KOPIEREN
========================================

Falls Policies nicht funktionieren:
1. Einen neuen Bucket ohne RLS-Policies testen
2. Im Supabase-Dashboard:
   - Delete "supplier-invoice"
   - Create "lieferscheine"
   - Stelle sicher, dass "Public bucket" aktiviert ist
   - Klicke "Create bucket" (ohne Policies zu setzen)
3. Teste dann den Upload in der App
