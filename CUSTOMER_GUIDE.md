# 🔧 Werkstatt-App SaaS – Kundenhandbuch

## Willkommen!

Sie haben sich für die **Werkstatt-App** angemeldet – die moderne Lösung für Ihre Autowerkstatt. Diese Anleitung hilft Ihnen, die Plattform einzurichten und optimal zu nutzen.

---

## 📋 Inhaltsverzeichnis

1. [Erste Anmeldung](#erste-anmeldung)
2. [Ihren Betrieb einrichten](#ihren-betrieb-einrichten)
3. [Mitarbeiter einladen](#mitarbeiter-einladen)
4. [Abonnement aktivieren](#abonnement-aktivieren)
5. [Features konfigurieren](#features-konfigurieren)
6. [Erste Schritte mit der App](#erste-schritte-mit-der-app)
7. [FAQ & Troubleshooting](#faq--troubleshooting)

---

## 🚀 Erste Anmeldung

### Registrierung

1. Öffnen Sie https://werkstatt-app.de/auth/signup
2. Geben Sie ein:
   - **E-Mail-Adresse**: Ihre geschäftliche E-Mail
   - **Passwort**: Mindestens 12 Zeichen (Groß-, Kleinbuchstaben, Zahlen, Sonderzeichen)
3. Klicken Sie auf **"Konto erstellen"**
4. Bestätigen Sie Ihre E-Mail-Adresse über den Link in der E-Mail

### Login

- URL: https://werkstatt-app.de/login
- Verwenden Sie Ihre E-Mail und Passwort
- Nach dem Login sehen Sie das **Dashboard** mit einer Anleitung

---

## 🏢 Ihren Betrieb einrichten

Nach dem ersten Login werden Sie zu einem Setup-Wizard geleitet:

### Schritt 1: Betrieb-Informationen

Geben Sie Folgendes ein:

| Feld | Beschreibung | Beispiel |
|------|-------------|---------|
| **Betriebsname** | Name Ihrer Werkstatt | "Müller & Söhne Werkstatt" |
| **Straße & Hausnummer** | Betriebsadresse | "Hauptstr. 42" |
| **PLZ & Stadt** | Postleitzahl & Stadt | "80331 München" |
| **Telefon** | Geschäftstelefon | "+49 89 123456" |
| **E-Mail** | Betriebliches Kontakt-Email | "kontakt@mueller-werkstatt.de" |

### Schritt 2: Betrieb speichern

- Klicken Sie auf **"Speichern"**
- Ihr Betrieb wird mit dem aktuellen Benutzer verknüpft
- Sie werden automatisch als **Admin** eingestuft

### Schritt 3: Bestätigung

Sie sehen jetzt:
- ✅ Betrieb erfolgreich erstellt
- 📊 Dashboard mit Überblick
- ⚙️ Link zu "Settings" in der Topbar

---

## 👥 Mitarbeiter einladen

Damit Ihre Mitarbeiter Zugang zur App haben:

### Admin-Bereich aufrufen

1. Klicken Sie auf die **Topbar** (oben rechts)
2. Wählen Sie **"Admin"** oder **"Einstellungen"**
3. Gehen Sie zu **"Mitarbeiter"** oder **"Benutzer verwalten"**

### Neuen Benutzer einladen

1. Klicken Sie auf **"+ Mitarbeiter einladen"**
2. Geben Sie ein:
   - **E-Mail-Adresse** des Mitarbeiters
   - **Rolle** (siehe Tabelle unten):

| Rolle | Berechtigungen | Ideal für |
|-------|----------------|----------|
| **Admin** | Alle Funktionen + Benutzerverwaltung | Geschäftsführer |
| **Werkstattmeister** | Aufträge, Fahrzeuge, Rechnungen | Betriebsleiter |
| **Mechaniker** | Aufträge & Fahrzeuge bearbeiten | Techniker |
| **Buchhalter** | Rechnungen & Statistiken | Buchführung |

3. Klicken Sie auf **"Einladung senden"**
4. Der Mitarbeiter erhält eine E-Mail mit:
   - Link zur Registrierung
   - Automatischer Zuordnung zu Ihrem Betrieb
   - Vorgefüllter Rolle

### Benutzer verwalten

- **Rolle ändern**: Klick auf Benutzer → Rolle aktualisieren
- **Benutzer entfernen**: Klick auf Benutzer → "Entfernen"
- **Aktive Benutzer sehen**: Liste zeigt alle Mitarbeiter + letzter Login

---

## 💳 Abonnement aktivieren

Die Werkstatt-App läuft im **Abonnement-Modell**:

### Preise

| Paket | Preis | Laufzeit | Inbegriff |
|-------|-------|----------|-----------|
| **Setup-Gebühr** | €2.000 | Einmalig | Einrichtung & Support |
| **Abo-Gebühr** | €199 | Pro Monat | Alle Features |

### Zahlung aktivieren

1. Gehen Sie zu **Admin → Zahlungen** oder **Settings → Abonnement**
2. Klicken Sie auf **"Zahlungsmethode hinzufügen"**
3. Sie werden zu Stripe (sicherer Zahlungsanbieter) weitergeleitet
4. Geben Sie ein:
   - **Kartendaten** (Kreditkarte, Lastschrift)
   - **Rechnungsadresse**
5. Klicken Sie auf **"Zahlung abschließen"**

### Nach erfolgreicher Zahlung

- ✅ Sie erhalten eine Bestätigungsmail
- ✅ Ihr Betrieb wird sofort aktiviert
- ✅ Monatliche Rechnungen werden automatisch generiert
- ✅ Abonnement verlängert sich monatlich zum gleichen Datum

### Zahlungsausfälle

Falls eine Zahlung fehlschlägt:
- Sie erhalten eine Benachrichtigung per E-Mail
- **Grace Period**: 3 Tage zur Behebung
- Nach 3 Tagen: Betrieb wird gesperrt
- Sie können jederzeit die Zahlungsmethode aktualisieren

---

## ⚙️ Features konfigurieren

Nicht alle Features sind für jeden Betrieb notwendig. Sie können Features flexibel aktivieren/deaktivieren:

### Feature-Verwaltung

1. Gehen Sie zu **Admin → Features**
2. Sehen Sie alle verfügbaren Features mit Beschreibung
3. Toggle-Button aktiviert/deaktiviert Features pro Betrieb

### Verfügbare Features

| Feature | Beschreibung | Für wen | Standard |
|---------|-------------|---------|----------|
| **Rechnungssystem** | Automatische Rechnungserstellung (PDF + E-Mail) | Alle | ✅ Ein |
| **Teile-Bestellen** | Lager & Bestellverwaltung | Großwerkstätten | ✅ Ein |
| **Kalender** | Termin-Planung & Scheduling | Alle | ✅ Ein |
| **Statistiken** | Auswertungen & Reports | Geschäftsführer | ✅ Ein |
| **E-Mail-Sync** | Automatisches Lesen von Kundenmails | Service | ❌ Aus |
| **KI-Teilevorschlag** | KI-gestützte Teile-Empfehlungen | Progressive | ❌ Aus |

### Tipps zum Aktivieren

- **Starten Sie schlank**: Aktivieren Sie nur die Features, die Sie nutzen
- **Features später aktivieren**: Jederzeit möglich – keine Neuinstallation nötig
- **Kosten sparen**: Deaktivierte Features verursachen keine Zusatzkosten
- **Support**: Fragen zu Features? Kontaktieren Sie support@werkstatt-app.de

---

## 🎯 Erste Schritte mit der App

### Dashboard-Überblick

Nach dem Login sehen Sie:

1. **Topbar** (oben): 
   - Betrieb-Selector (falls Sie mehrere Betriebe haben)
   - Benachrichtigungen
   - Profil & Logout

2. **Sidebar** (links):
   - 📊 Dashboard
   - 🚗 Fahrzeuge
   - 🔧 Aufträge
   - 📝 Rechnungen (wenn aktiviert)
   - 📊 Auswertung (wenn aktiviert)
   - 📅 Kalender (wenn aktiviert)
   - ⚙️ Admin

3. **Hauptbereich** (Mitte):
   - Aktuelle Daten
   - Quick-Aktionen (z.B. "Neuer Auftrag")
   - Statistiken

### Erste Aktion: Fahrzeug anlegen

1. Klicken Sie auf **"Fahrzeuge"** in der Sidebar
2. Klicken Sie auf **"+ Neues Fahrzeug"**
3. Geben Sie ein:
   - Marke (z.B. "BMW")
   - Modell (z.B. "3er")
   - Kennzeichen (z.B. "MUC-AB 123")
   - Weitere Daten (optional)
4. Klicken Sie auf **"Speichern"**

### Zweite Aktion: Auftrag erstellen

1. Klicken Sie auf **"Aufträge"** in der Sidebar
2. Klicken Sie auf **"+ Neuen Auftrag"**
3. Wählen Sie das Fahrzeug und den Kunden
4. Beschreiben Sie die Arbeiten
5. Klicken Sie auf **"Speichern"**

### Videos & Tutorials

Wir bieten kurze Video-Tutorials für alle Features:
- Dashboard-Überblick (3 min)
- Auftrag-Management (5 min)
- Rechnungs-Erstellung (4 min)
- Mobile.de Integration (3 min)

👉 **Zu den Videos**: https://werkstatt-app.de/tutorials

---

## ❓ FAQ & Troubleshooting

### Login-Probleme

**F: Ich vergesse mein Passwort**
- A: Klicken Sie auf **"Passwort vergessen?"** auf der Login-Seite
- Sie erhalten einen Reset-Link per E-Mail
- Link gültig für 24 Stunden

**F: Ich kann nicht auf die App zugreifen**
- A: 
  - Überprüfen Sie Ihre Internetverbindung
  - Versuchen Sie einen anderen Browser
  - Clearen Sie Ihren Browser-Cache (Strg+Shift+Delete)
  - Falls das nicht hilft: support@werkstatt-app.de

### Datenschutz & Sicherheit

**F: Sind meine Daten sicher?**
- A: Ja! Wir verwenden:
  - 🔐 Verschlüsselte Datenbank (Supabase)
  - 🔒 DSGVO-konform (EU-Standard)
  - 🛡️ Automatische Backups
  - 🔑 Sichere Authentifizierung (zwei-Faktor-Auth verfügbar)

**F: Kann der Support auf meine Daten zugreifen?**
- A: Nein. Nur Sie haben Zugriff auf Ihre Daten.
- Support kann Ihnen helfen, aber kann nicht Ihre Daten einsehen.

### Abonnement & Zahlung

**F: Kann ich monatlich kündigen?**
- A: Ja, jederzeit. Sie zahlen nur für die Monate, in denen Sie die App nutzen.
- Kündigungen erfolgen zum Ende des Monats.

**F: Wie kann ich die Zahlungsmethode ändern?**
- A: 
  1. Gehen Sie zu **Admin → Zahlungen**
  2. Klicken Sie auf **"Zahlungsmethode bearbeiten"**
  3. Geben Sie neue Kartendaten ein

**F: Bekomme ich eine Rechnung?**
- A: Ja! Automatisch per E-Mail am 1. des Monats.
- PDF ist herunterladbar & archivierbar.

### Mehrere Betriebe verwalten

**F: Kann ich mehrere Werkstätten mit einem Account verwalten?**
- A: Ja! So funktioniert's:
  1. Sie sind Admin bei Betrieb A
  2. Bitten Sie den Admin von Betrieb B, Sie einzuladen
  3. Sie sehen jetzt einen **Betrieb-Selector** in der Topbar
  4. Sie können zwischen Betrieben wechseln

---

## 📞 Support & Kontakt

Haben Sie Fragen oder Probleme?

| Kanal | Details |
|-------|---------|
| **E-Mail** | support@werkstatt-app.de |
| **Telefon** | +49 89 XXXXXXX |
| **Live-Chat** | Montag–Freitag, 9–17 Uhr (in der App) |
| **Community-Forum** | https://forum.werkstatt-app.de |

### Support-Zeiten

- 🇩🇪 Deutsche Support-Stunden: Mo–Fr 9:00–17:00 Uhr
- 🇬🇧 English Support: Di–Do 10:00–16:00 Uhr
- 🚨 Notfall (Datenverlust): 24/7 verfügbar

---

## 📚 Weitere Ressourcen

- **Vollständige Dokumentation**: https://werkstatt-app.de/docs
- **Best-Practices**: https://werkstatt-app.de/best-practices
- **API für Entwickler**: https://werkstatt-app.de/api-docs
- **Status-Seite**: https://status.werkstatt-app.de

---

## 🎉 Viel Erfolg!

Willkommen in der Werkstatt-App Familie! 🚗

Wenn Sie Feedback haben oder Verbesserungen vorschlagen möchten, schreiben Sie uns jederzeit an **feedback@werkstatt-app.de**.

**Viel Erfolg mit der Verwaltung Ihrer Werkstatt!**

---

*Letzte Aktualisierung: Juli 2026*
*Version: 1.0*
