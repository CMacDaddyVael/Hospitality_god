-- Migration: 002_stripe_webhook
-- Adds the subscriptions table and stripe_processed_events idempotency log
-- Required by #174 — Stripe webhook handler

-- ── subscriptions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id           TEXT,                        -- Supabase auth user ID (nullable during beta)
  stripe_customer_id      TEXT NOT NULL,
  stripe_subscription_id  TEXT NOT NULL UNIQUE,        -- conflict target for upserts
  tier                    TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'autopilot')),
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'incomplete', 'trialing', 'unpaid')),
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_owner_user_id_idx  ON subscriptions (owner_user_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx ON subscriptions (stripe_customer_id);

-- ── stripe_processed_events ──────────────────────────────────────────────────
-- Idempotency log: one row per Stripe event we have successfully processed.
-- Checked before handling so duplicate webhook deliveries are no-ops.
CREATE TABLE IF NOT EXISTS stripe_processed_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stripe_processed_events_event_id_idx ON stripe_processed_events (stripe_event_id);

-- ── deliverables ─────────────────────────────────────────────────────────────
-- Created here if it doesn't already exist so provisioning can insert rows.
CREATE TABLE IF NOT EXISTS deliverables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL,
  owner_user_id TEXT,
  type          TEXT NOT NULL,          -- 'review_response' | 'listing_copy' | 'social_post' | ...
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
  content       TEXT NOT NULL,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deliverables_property_id_idx    ON deliverables (property_id);
CREATE INDEX IF NOT EXISTS deliverables_owner_user_id_idx  ON deliverables (owner_user_id);
CREATE INDEX IF NOT EXISTS deliverables_type_status_idx    ON deliverables (type, status);

-- ── properties ───────────────────────────────────────────────────────────────
-- Created here if it doesn't already exist so resolvePropertyId can query it.
CREATE TABLE IF NOT EXISTS properties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT,
  listing_data  JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS properties_owner_user_id_idx ON properties (owner_user_id);

-- Row-level security: service-role key bypasses RLS so webhook handler can write freely.
-- Enable RLS on these tables so the anon/authenticated keys can't bypass policies.
ALTER TABLE subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables           ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties             ENABLE ROW LEVEL SECURITY;
