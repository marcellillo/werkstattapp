-- RLS Policies für Zahlungs-Tabellen

-- betrieb_subscription: nur Admin + Owner können sehen
CREATE POLICY "betrieb_subscription_select" ON betrieb_subscription FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users 
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "betrieb_subscription_update" ON betrieb_subscription FOR UPDATE
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users 
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

-- betrieb_payment_events: Audit log, read-only für admins
CREATE POLICY "betrieb_payment_events_select" ON betrieb_payment_events FOR SELECT
  USING (
    betrieb_id IN (
      SELECT betrieb_id FROM betrieb_users 
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

-- Webhook writes directly via Admin Client (no RLS needed for inserts)
-- But we enable it for completeness:
CREATE POLICY "betrieb_payment_events_insert" ON betrieb_payment_events FOR INSERT
  WITH CHECK (TRUE);
