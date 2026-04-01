-- Migration: 003_subscribers_table
-- Creates the subscribers table if it does not already exist.
-- Safe to run even if the table already exists (IF NOT EXISTS guard).
-- Additive only — does not alter existing tables.

CREATE TABLE IF NOT EXISTS subscribers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL UNIQUE,
  listing_url         TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'inactive'
                        CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'past_due')),
  stripe_customer_id  TEXT,
  stripe_subscription_id TEXT,
  preferences         JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscribers_status  ON subscribers (subscription_status);
CREATE INDEX IF NOT EXISTS idx_subscribers_email   ON subscribers (email);

COMMENT ON TABLE  subscribers                        IS 'Paying VAEL Host subscribers — source of truth for the scheduler';
COMMENT ON COLUMN subscribers.subscription_status   IS 'active = paid and swarm should run; inactive/cancelled/past_due = skip';
COMMENT ON COLUMN subscribers.preferences           IS 'JSON bag of selected services (social, reviews, seo, etc.)';
