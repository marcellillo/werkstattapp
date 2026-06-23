# Bauprojekt Management App – Setup-Anleitung

## 1. Supabase-Projekt erstellen

1. Gehen Sie auf https://supabase.com und erstellen Sie ein kostenloses Konto
2. Erstellen Sie ein neues Projekt (z.B. "bauprojekt-management")
3. Wählen Sie eine Region in Europa (z.B. Frankfurt)
4. Notieren Sie das Passwort – Sie brauchen es nicht mehr, aber es ist sicher aufzubewahren

## 2. Datenbank einrichten

1. Im Supabase Dashboard: **SQL Editor** öffnen
2. Den kompletten Inhalt von `supabase/schema.sql` kopieren und ausführen
3. Dies erstellt alle Tabellen, Rollen, Trigger und einen Standard-Workflow

## 3. Umgebungsvariablen konfigurieren

Öffnen Sie `.env.local` und ersetzen Sie die Platzhalter:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

Diese Werte finden Sie im Supabase Dashboard unter:
**Settings → API**

## 4. Ersten Benutzer anlegen

1. Supabase Dashboard → **Authentication → Users → Add user**
2. E-Mail und Passwort eingeben
3. In der `profiles`-Tabelle die Rolle auf `admin` setzen:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'ihre@email.de';
   ```

## 5. App starten

```bash
npm run dev
```

Die App läuft dann auf: http://localhost:3000

## 6. OneDrive-Integration (optional)

Für automatische OneDrive-Ordnererstellung:
1. Azure Portal → App Registration erstellen
2. Microsoft Graph API Berechtigung: `Files.ReadWrite.All`
3. Client ID und Secret in `.env.local` eintragen:
   ```env
   AZURE_CLIENT_ID=...
   AZURE_CLIENT_SECRET=...
   AZURE_TENANT_ID=...
   ```

## Produktiv-Deployment (Vercel)

```bash
npm install -g vercel
vercel --prod
```
Umgebungsvariablen im Vercel Dashboard unter **Settings → Environment Variables** eintragen.

## Funktionen im Überblick

| Seite | Pfad | Beschreibung |
|-------|------|--------------|
| Dashboard | /dashboard | Übersicht aller KPIs und Projekte |
| Projekte | /projekte | Alle Bauvorhaben, Suche, Filter |
| Projekt-Detail | /projekte/[id] | Ampelsystem, Live-Updates, Feed |
| Neues Projekt | /projekte/neu | Anlegen mit Vorlage |
| Kunden | /kunden | CRM, Kontaktverwaltung |
| Leads | /leads | Kanban-Board, Lead-zu-Projekt |
| Vorlagen | /vorlagen | Wiederverwendbare Bauabläufe |
| Team | /team | Mitarbeiter, Rollenverwaltung |
| Dokumente | /dokumente | Alle Anhänge zentral |
| Benachrichtigungen | /benachrichtigungen | Aktivitätsmeldungen |
