-- ============================================================
-- Update v4: Werkstatt-Einstellungen Tabelle für MS Graph API
-- ============================================================

CREATE TABLE IF NOT EXISTS werkstatt_einstellungen (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schluessel  text UNIQUE NOT NULL,
  wert        text,
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now()
);

ALTER TABLE werkstatt_einstellungen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nur_auth" ON werkstatt_einstellungen FOR ALL USING (auth.uid() IS NOT NULL);

-- Standard-Einträge
INSERT INTO werkstatt_einstellungen (schluessel, wert) VALUES
  ('ms_tenant_id', NULL),
  ('ms_client_id', NULL),
  ('ms_client_secret', NULL),
  ('ms_email_address', 'werkstatt@heliosautomobile.de'),
  ('email_sync_aktiv', 'false'),
  ('email_sync_intervall_min', '15')
ON CONFLICT (schluessel) DO NOTHING;
