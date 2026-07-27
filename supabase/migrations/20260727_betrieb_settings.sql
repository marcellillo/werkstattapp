-- Betrieb Settings Tabelle
CREATE TABLE betrieb_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL UNIQUE REFERENCES betriebe(id) ON DELETE CASCADE,

  -- Firmendaten
  firma_name TEXT,
  firma_strasse TEXT,
  firma_plz TEXT,
  firma_ort TEXT,
  firma_telefon TEXT,
  firma_email TEXT,
  firma_ust_id TEXT,
  firma_steuernummer TEXT,
  firma_iban TEXT,
  firma_bic TEXT,
  firma_bank TEXT,
  firma_stundensatz TEXT,
  firma_kleinunternehmer TEXT DEFAULT 'nein',
  firma_logo TEXT,

  -- Zahlungsmethoden
  firma_paypal TEXT,
  firma_sumup TEXT,
  firma_stripe TEXT,

  -- Email-Sync (IMAP)
  imap_email TEXT,
  imap_password TEXT,

  -- Microsoft Graph (OAuth)
  graph_client_id TEXT,
  graph_tenant_id TEXT,
  graph_client_secret TEXT,
  graph_email TEXT,
  graph_refresh_token TEXT,

  -- API Keys
  anthropic_api_key TEXT,
  resend_api_key TEXT,
  firma_absender_email TEXT,

  -- Timestamps
  erstellt_am TIMESTAMPTZ DEFAULT NOW(),
  aktualisiert_am TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_betrieb_settings_betrieb ON betrieb_settings(betrieb_id);

-- RLS Policies
ALTER TABLE betrieb_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_betrieb" ON betrieb_settings FOR SELECT
  USING (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users WHERE profile_id = auth.uid()
  ));

CREATE POLICY "insert_own_betrieb" ON betrieb_settings FOR INSERT
  WITH CHECK (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users
    WHERE profile_id = auth.uid() AND rolle = 'admin'
  ));

CREATE POLICY "update_own_betrieb" ON betrieb_settings FOR UPDATE
  USING (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users
    WHERE profile_id = auth.uid() AND rolle = 'admin'
  ));
