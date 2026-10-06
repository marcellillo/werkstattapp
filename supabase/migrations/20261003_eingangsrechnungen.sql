-- Eingangsrechnungen (Lieferantenrechnungen per E-Mail / Upload):
--  * die PDF-Datei wird jetzt in der App abgelegt (privater Storage-Bucket)
--  * Herkunft der Rechnung (E-Mail / Upload) und Mail-Bezug
--  * Duplikatschutz ueber Datei-Hash
--  * Protokoll bereits verarbeiteter E-Mails (kein erneutes Auslesen bei jedem Sync)

ALTER TABLE rechnungen
  ADD COLUMN IF NOT EXISTS datei_pfad          text,
  ADD COLUMN IF NOT EXISTS datei_name          text,
  ADD COLUMN IF NOT EXISTS datei_typ           text,
  ADD COLUMN IF NOT EXISTS datei_hash          text,
  ADD COLUMN IF NOT EXISTS quelle              text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS email_betreff       text,
  ADD COLUMN IF NOT EXISTS email_empfangen_am  timestamptz,
  ADD COLUMN IF NOT EXISTS email_link          text,
  ADD COLUMN IF NOT EXISTS pruefen             boolean NOT NULL DEFAULT false;

-- Altbestand: Rechnungen mit Absender-Adresse stammen aus dem E-Mail-Import
UPDATE rechnungen SET quelle = 'email' WHERE absender_email IS NOT NULL AND quelle = 'upload';

CREATE UNIQUE INDEX IF NOT EXISTS rechnungen_betrieb_datei_hash_uniq
  ON rechnungen (betrieb_id, datei_hash) WHERE datei_hash IS NOT NULL;

-- Verarbeitete E-Mails (nur ueber den Service-Role-Client erreichbar: RLS an, keine Policies)
CREATE TABLE IF NOT EXISTS email_verarbeitet (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id     uuid NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  message_id     text NOT NULL,
  ergebnis       text,
  verarbeitet_am timestamptz NOT NULL DEFAULT now(),
  UNIQUE (betrieb_id, message_id)
);
ALTER TABLE email_verarbeitet ENABLE ROW LEVEL SECURITY;

-- Privater Bucket fuer die Rechnungs-Dateien. Keine Storage-Policies: Zugriff nur ueber
-- die API (Mitgliedschaftspruefung, dann kurzlebiger signierter Link).
INSERT INTO storage.buckets (id, name, public)
VALUES ('eingangsrechnungen', 'eingangsrechnungen', false)
ON CONFLICT (id) DO NOTHING;
