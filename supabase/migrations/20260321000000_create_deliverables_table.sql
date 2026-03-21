-- Migration: Create deliverables table
-- Issue #225: Build deliverables database schema + agent output writer
-- Created: 2026-03-21

-- Create the deliverable type enum
CREATE TYPE deliverable_type AS ENUM (
  'listing_copy',
  'review_response',
  'social_post',
  'competitive_report',
  'seasonal_update'
);

-- Create the deliverable status enum
CREATE TYPE deliverable_status AS ENUM (
  'pending_review',
  'approved',
  'used',
  'dismissed'
);

-- Create the deliverables table
CREATE TABLE deliverables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  listing_id      TEXT,                        -- nullable: some deliverables are account-level
  type            deliverable_type NOT NULL,
  title           TEXT NOT NULL,
  content_json    JSONB NOT NULL DEFAULT '{}',
  status          deliverable_status NOT NULL DEFAULT 'pending_review',
  agent_version   TEXT NOT NULL DEFAULT '1.0.0',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ                  -- null until owner takes action
);

-- Index for the most common query: pending deliverables for a subscriber
CREATE INDEX idx_deliverables_subscriber_status
  ON deliverables (subscriber_id, status, created_at DESC);

-- Index for per-listing queries (listing optimizer dashboard)
CREATE INDEX idx_deliverables_listing
  ON deliverables (listing_id)
  WHERE listing_id IS NOT NULL;

-- Index for type-based filtering
CREATE INDEX idx_deliverables_type
  ON deliverables (type, created_at DESC);

-- Enable Row Level Security
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;

-- Policy: subscribers can only read their own deliverables
CREATE POLICY "subscribers_read_own_deliverables"
  ON deliverables
  FOR SELECT
  USING (subscriber_id = auth.uid());

-- Policy: service role (agents) can insert deliverables for any subscriber
-- (agents run with service_role key, bypasses RLS automatically)
-- This comment documents the intent; no explicit policy needed for service_role.

-- Policy: subscribers can update status of their own deliverables (approval UI)
CREATE POLICY "subscribers_update_own_deliverable_status"
  ON deliverables
  FOR UPDATE
  USING (subscriber_id = auth.uid())
  WITH CHECK (subscriber_id = auth.uid());

COMMENT ON TABLE deliverables IS
  'Central storage for all AI-generated content deliverables. Every content agent writes here; the dashboard and weekly brief read from here.';

COMMENT ON COLUMN deliverables.listing_id IS
  'External listing identifier (e.g. Airbnb room ID). NULL for account-level deliverables like competitive reports.';

COMMENT ON COLUMN deliverables.content_json IS
  'Structured content payload. Schema varies by type — see docs/deliverable-schemas.md for per-type contracts.';

COMMENT ON COLUMN deliverables.agent_version IS
  'Semver string of the agent that produced this deliverable. Used for debugging and future schema migrations.';

COMMENT ON COLUMN deliverables.reviewed_at IS
  'Timestamp when the owner took any approval action (approved / used / dismissed). NULL while status = pending_review.';
