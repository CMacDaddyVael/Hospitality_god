-- ============================================================
-- VAEL Host — Core MVP Schema
-- Migration: 20260320000001_create_core_schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE audit_status AS ENUM ('pending', 'complete', 'failed');

CREATE TYPE deliverable_type AS ENUM (
  'listing_copy',
  'review_response',
  'social_post',
  'seasonal_update',
  'guest_template',
  'competitive_intel'
);

CREATE TYPE deliverable_status AS ENUM (
  'pending',
  'ready',
  'approved',
  'dismissed'
);

CREATE TYPE subscription_tier AS ENUM ('free', 'pro');

CREATE TYPE subscription_status AS ENUM (
  'active',
  'past_due',
  'canceled',
  'trialing',
  'incomplete'
);

-- ============================================================
-- TABLE: owners
-- Mirrors Supabase auth.users with STR-specific profile data.
-- owner_id references auth.users(id) so RLS can use auth.uid().
-- ============================================================

CREATE TABLE owners (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT NOT NULL,
  full_name        TEXT,
  phone            TEXT,
  company_name     TEXT,
  avatar_url       TEXT,
  onboarding_step  TEXT DEFAULT 'listing_url',
  onboarding_done  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE owners IS 'STR owner profile data, extending Supabase auth.users';
COMMENT ON COLUMN owners.id IS 'FK to auth.users(id) — same UUID';
COMMENT ON COLUMN owners.onboarding_step IS 'Last completed onboarding step slug';

-- ============================================================
-- TABLE: properties
-- One row per scraped/registered STR listing.
-- ============================================================

CREATE TABLE properties (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  airbnb_url      TEXT NOT NULL,
  vrbo_url        TEXT,
  platform        TEXT NOT NULL DEFAULT 'airbnb' CHECK (platform IN ('airbnb', 'vrbo', 'both')),
  title           TEXT,
  location        TEXT,
  bedroom_count   INTEGER,
  bathroom_count  NUMERIC(4,1),
  max_guests      INTEGER,
  property_type   TEXT,
  price_per_night NUMERIC(10,2),
  rating          NUMERIC(3,2),
  review_count    INTEGER DEFAULT 0,
  listing_data    JSONB NOT NULL DEFAULT '{}'::JSONB,
  photo_urls      JSONB NOT NULL DEFAULT '[]'::JSONB,
  amenities       JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_scraped_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE properties IS 'STR listing data, scraped and stored per owner';
COMMENT ON COLUMN properties.listing_data IS 'Full canonical JSONB object from scraper — all raw fields';
COMMENT ON COLUMN properties.photo_urls IS 'Array of photo URL strings scraped from listing';
COMMENT ON COLUMN properties.amenities IS 'Array of amenity strings scraped from listing';

CREATE INDEX idx_properties_owner_id ON properties(owner_id);
CREATE INDEX idx_properties_airbnb_url ON properties(airbnb_url);
CREATE INDEX idx_properties_created_at ON properties(created_at DESC);

-- ============================================================
-- TABLE: audits
-- One record per scoring run on a property.
-- ============================================================

CREATE TABLE audits (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id     UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  score_total  NUMERIC(5,2) CHECK (score_total >= 0 AND score_total <= 100),
  status       audit_status NOT NULL DEFAULT 'pending',
  scored_at    TIMESTAMPTZ,
  report_data  JSONB NOT NULL DEFAULT '{}'::JSONB,
  error_detail TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audits IS 'One audit run per property — stores overall score and run metadata';
COMMENT ON COLUMN audits.score_total IS 'Composite score 0-100 across all categories';
COMMENT ON COLUMN audits.report_data IS 'Full audit report JSONB including recommendations, highlights, etc.';
COMMENT ON COLUMN audits.error_detail IS 'Populated when status = failed — reason for failure';

CREATE INDEX idx_audits_property_id ON audits(property_id);
CREATE INDEX idx_audits_owner_id ON audits(owner_id);
CREATE INDEX idx_audits_scored_at ON audits(scored_at DESC);
CREATE INDEX idx_audits_status ON audits(status);

-- ============================================================
-- TABLE: audit_scores
-- Per-category score breakdown rows for each audit.
-- ============================================================

CREATE TABLE audit_scores (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id       UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  category_name  TEXT NOT NULL,
  weight         NUMERIC(5,4) NOT NULL CHECK (weight > 0 AND weight <= 1),
  raw_score      NUMERIC(5,2) NOT NULL CHECK (raw_score >= 0 AND raw_score <= 100),
  weighted_score NUMERIC(5,2) NOT NULL CHECK (weighted_score >= 0),
  notes          TEXT,
  recommendations JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_scores IS 'Per-category score breakdown for each audit run';
COMMENT ON COLUMN audit_scores.weight IS 'Category weight as decimal (e.g., 0.25 = 25% of total)';
COMMENT ON COLUMN audit_scores.raw_score IS 'Raw score 0-100 before weighting';
COMMENT ON COLUMN audit_scores.weighted_score IS 'raw_score * weight — contributes to score_total';
COMMENT ON COLUMN audit_scores.recommendations IS 'Array of action strings for this category';

CREATE INDEX idx_audit_scores_audit_id ON audit_scores(audit_id);

-- ============================================================
-- TABLE: deliverables
-- AI-generated content ready for owner review/approval.
-- ============================================================

CREATE TABLE deliverables (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  audit_id      UUID REFERENCES audits(id) ON DELETE SET NULL,
  type          deliverable_type NOT NULL,
  status        deliverable_status NOT NULL DEFAULT 'pending',
  title         TEXT,
  payload       JSONB NOT NULL DEFAULT '{}'::JSONB,
  approved_at   TIMESTAMPTZ,
  dismissed_at  TIMESTAMPTZ,
  dismissed_reason TEXT,
  scheduled_for TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE deliverables IS 'AI-generated content deliverables awaiting owner review';
COMMENT ON COLUMN deliverables.type IS 'Type of deliverable — controls rendering in dashboard';
COMMENT ON COLUMN deliverables.payload IS 'Full generated content JSONB — structure varies by type';
COMMENT ON COLUMN deliverables.scheduled_for IS 'Optional: when this deliverable is intended to be posted/used';

CREATE INDEX idx_deliverables_property_id ON deliverables(property_id);
CREATE INDEX idx_deliverables_owner_id ON deliverables(owner_id);
CREATE INDEX idx_deliverables_status ON deliverables(status);
CREATE INDEX idx_deliverables_type ON deliverables(type);
CREATE INDEX idx_deliverables_created_at ON deliverables(created_at DESC);

-- ============================================================
-- TABLE: deliverable_status_log
-- Immutable audit log of every status transition for deliverables.
-- ============================================================

CREATE TABLE deliverable_status_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deliverable_id  UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  from_status     deliverable_status,
  to_status       deliverable_status NOT NULL,
  changed_by      UUID REFERENCES owners(id) ON DELETE SET NULL,
  reason          TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE deliverable_status_log IS 'Immutable audit trail of deliverable status transitions';
COMMENT ON COLUMN deliverable_status_log.from_status IS 'NULL on first insert (pending creation)';
COMMENT ON COLUMN deliverable_status_log.changed_by IS 'Owner who triggered the change, NULL if system-triggered';

CREATE INDEX idx_dsl_deliverable_id ON deliverable_status_log(deliverable_id);
CREATE INDEX idx_dsl_created_at ON deliverable_status_log(created_at DESC);

-- ============================================================
-- TABLE: subscriptions
-- Mirrors Stripe subscription state for each owner.
-- ============================================================

CREATE TABLE subscriptions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id               UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  tier                   subscription_tier NOT NULL DEFAULT 'free',
  status                 subscription_status NOT NULL DEFAULT 'active',
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
  trial_end              TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_owner_unique UNIQUE (owner_id)
);

COMMENT ON TABLE subscriptions IS 'Stripe subscription state — one row per owner';
COMMENT ON COLUMN subscriptions.stripe_customer_id IS 'Stripe cus_xxx — nullable until checkout completes';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Stripe sub_xxx — nullable for free tier';
COMMENT ON COLUMN subscriptions.tier IS 'free | pro — controls feature access';
COMMENT ON COLUMN subscriptions.current_period_end IS 'When current billing period ends — used to gate pro features';

CREATE INDEX idx_subscriptions_owner_id ON subscriptions(owner_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);

-- ============================================================
-- TABLE: voice_profiles
-- Owner tone/style preferences for AI content generation.
-- ============================================================

CREATE TABLE voice_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id            UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  tone                TEXT NOT NULL DEFAULT 'warm' CHECK (tone IN ('casual', 'professional', 'warm', 'luxury')),
  sign_off_name       TEXT,
  always_use          TEXT,
  never_use           TEXT,
  personality_notes   TEXT,
  sample_review_response TEXT,
  extracted_traits    JSONB NOT NULL DEFAULT '{}'::JSONB,
  calibration_version INTEGER NOT NULL DEFAULT 1,
  last_calibrated_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT voice_profiles_owner_unique UNIQUE (owner_id)
);

COMMENT ON TABLE voice_profiles IS 'Owner tone and style preferences for AI content generation';
COMMENT ON COLUMN voice_profiles.tone IS 'Primary tone descriptor — maps to prompt system instructions';
COMMENT ON COLUMN voice_profiles.always_use IS 'Words/phrases to always include — comma separated or freeform';
COMMENT ON COLUMN voice_profiles.never_use IS 'Words/phrases to avoid — comma separated or freeform';
COMMENT ON COLUMN voice_profiles.extracted_traits IS 'AI-extracted style traits from sample text — used in prompts';
COMMENT ON COLUMN voice_profiles.calibration_version IS 'Incremented on each recalibration — enables rollback comparison';

CREATE INDEX idx_voice_profiles_owner_id ON voice_profiles(owner_id);

-- ============================================================
-- TRIGGERS: updated_at auto-maintenance
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_owners_updated_at
  BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audits_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_deliverables_updated_at
  BEFORE UPDATE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_voice_profiles_updated_at
  BEFORE UPDATE ON voice_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
