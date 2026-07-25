-- v13: Stripe Payment Integration
-- Adds subscription & payment tracking for SaaS model

-- ============================================================================
-- Betrieb Subscriptions (Stripe-Integration)
-- ============================================================================

CREATE TABLE betrieb_subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL UNIQUE REFERENCES betriebe(id) ON DELETE CASCADE,

  -- Stripe IDs
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,

  -- Subscription Status
  status TEXT DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'past_due', 'canceled', 'pending')),

  -- Billing Info
  monthly_price_cents INTEGER DEFAULT 19900, -- €199.00
  setup_fee_cents INTEGER DEFAULT 200000,    -- €2000.00 (one-time)
  setup_fee_paid BOOLEAN DEFAULT FALSE,

  -- Timeline
  subscription_start TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,

  -- Trial (optional)
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,

  -- Contact Info for Invoices
  billing_email TEXT,
  company_name TEXT,
  company_address TEXT,
  company_tax_id TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_webhook_event_id TEXT
);

CREATE INDEX idx_betrieb_subscription_stripe_customer ON betrieb_subscription(stripe_customer_id);
CREATE INDEX idx_betrieb_subscription_stripe_subscription ON betrieb_subscription(stripe_subscription_id);
CREATE INDEX idx_betrieb_subscription_status ON betrieb_subscription(status);

-- ============================================================================
-- Payment History (für Auditing)
-- ============================================================================

CREATE TABLE betrieb_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,

  -- Stripe Event
  stripe_event_id TEXT NOT NULL UNIQUE,
  stripe_event_type TEXT NOT NULL, -- 'invoice.paid', 'customer.subscription.created', etc.

  -- Data
  event_data JSONB,

  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_events_betrieb ON betrieb_payment_events(betrieb_id);
CREATE INDEX idx_payment_events_stripe_event ON betrieb_payment_events(stripe_event_id);
CREATE INDEX idx_payment_events_type ON betrieb_payment_events(stripe_event_type);

-- ============================================================================
-- Betrieb Status & Access Control (für Payment-Status)
-- ============================================================================

ALTER TABLE betriebe ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE betriebe ADD COLUMN is_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE betriebe ADD COLUMN suspension_reason TEXT;
ALTER TABLE betriebe ADD COLUMN suspended_at TIMESTAMPTZ;

CREATE INDEX idx_betriebe_is_active ON betriebe(is_active);
CREATE INDEX idx_betriebe_is_suspended ON betriebe(is_suspended);
