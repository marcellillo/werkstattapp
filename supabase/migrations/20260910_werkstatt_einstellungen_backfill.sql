-- werkstatt_einstellungen ist eine globale (nicht betrieb_id-gescopte) Key-Value-
-- Tabelle aus der Zeit vor Multi-Tenancy. Sie enthaelt u.a. live Microsoft-Graph
-- OAuth-Tokens, den Anthropic-API-Key und Bankdaten (IBAN/BIC/Steuernummer) fuer
-- Helios Automobile GmbH. Die RLS-Policy "nur_auth" erlaubt JEDEM eingeloggten
-- Nutzer -- unabhaengig vom eigenen Betrieb -- vollen Lese-/Schreibzugriff.
--
-- betrieb_einstellungen ist die korrekt betrieb-gescopte Ersatztabelle (gleiche
-- schluessel/wert-Form, siehe firma-settings.ts / resolveFirmaSettings). Diese
-- Migration kopiert alle bislang fehlenden bzw. leeren Werte von Helios aus der
-- alten globalen Tabelle in die neue, gescopte Tabelle -- OHNE bereits vorhandene,
-- nicht-leere Werte zu ueberschreiben (z.B. firma_name/firma_strasse, die bereits
-- korrekt gepflegt sind).
--
-- WICHTIG: Diese Migration allein aendert an werkstatt_einstellungen NICHTS --
-- die RLS-Luecke dort bleibt bestehen, bis 20260910_werkstatt_einstellungen_lockdown.sql
-- ausgefuehrt wird (siehe Hinweis dort: erst NACH dem zugehoerigen Code-Deploy laufen lassen).

INSERT INTO betrieb_einstellungen (betrieb_id, schluessel, wert)
SELECT
  (SELECT id FROM betriebe WHERE name = 'Helios Automobile GmbH'),
  we.schluessel,
  we.wert
FROM werkstatt_einstellungen we
WHERE we.wert IS NOT NULL AND we.wert <> ''
ON CONFLICT (betrieb_id, schluessel) DO UPDATE
  SET wert = EXCLUDED.wert
  WHERE betrieb_einstellungen.wert IS NULL OR betrieb_einstellungen.wert = '';
