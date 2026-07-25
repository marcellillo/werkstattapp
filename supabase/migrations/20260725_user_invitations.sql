-- Benutzer-Einladungen mit Token-basiertem System
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,

  -- Einladungs-Details
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE, -- Unique Token für den Link
  rolle TEXT NOT NULL DEFAULT 'mechaniker', -- admin, mechaniker, buchhalter

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, expired
  akzeptiert_am TIMESTAMPTZ,
  abgelaufen_am TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'), -- 7 Tage gültig

  -- Wer hat eingeladen?
  erstellt_von UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  erstellt_am TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT betrieb_email_unique UNIQUE(betrieb_id, email) -- Pro Betrieb nur 1x pro Email
);

-- Indexes
CREATE INDEX idx_invitations_betrieb ON user_invitations(betrieb_id);
CREATE INDEX idx_invitations_token ON user_invitations(token);
CREATE INDEX idx_invitations_email ON user_invitations(email);
CREATE INDEX idx_invitations_status ON user_invitations(status);

-- RLS Policies (nur Admins können einladen)
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_betrieb" ON user_invitations FOR SELECT
  USING (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users
    WHERE profile_id = auth.uid() AND rolle = 'admin'
  ));

CREATE POLICY "create_own_betrieb" ON user_invitations FOR INSERT
  WITH CHECK (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users
    WHERE profile_id = auth.uid() AND rolle = 'admin'
  ));

CREATE POLICY "update_own_betrieb" ON user_invitations FOR UPDATE
  USING (betrieb_id IN (
    SELECT betrieb_id FROM betrieb_users
    WHERE profile_id = auth.uid() AND rolle = 'admin'
  ));
