-- Migration: Create competitive_reports table for Issue #148
-- Stores competitive intelligence report metadata, competitor data, and Claude analysis

CREATE TABLE IF NOT EXISTS competitive_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,                        -- user/session identifier
  listing_id TEXT NOT NULL,                      -- owner's listing ID or URL
  listing_location TEXT NOT NULL,                -- city or area name
  listing_lat NUMERIC(10, 7),                    -- latitude (optional)
  listing_lng NUMERIC(10, 7),                    -- longitude (optional)
  bedroom_count INTEGER NOT NULL DEFAULT 1,
  competitor_listing_ids JSONB NOT NULL DEFAULT '[]',  -- array of scraped competitor IDs
  competitor_data JSONB NOT NULL DEFAULT '[]',         -- full competitor data array
  claude_output JSONB,                            -- structured Claude analysis output
  status TEXT NOT NULL DEFAULT 'pending'          -- pending | processing | complete | error
    CHECK (status IN ('pending', 'processing', 'complete', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up reports by owner
CREATE INDEX IF NOT EXISTS idx_competitive_reports_owner_id
  ON competitive_reports (owner_id);

-- Index for recent reports per listing
CREATE INDEX IF NOT EXISTS idx_competitive_reports_listing_id
  ON competitive_reports (listing_id, created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_competitive_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_competitive_reports_updated_at
  BEFORE UPDATE ON competitive_reports
  FOR EACH ROW EXECUTE FUNCTION update_competitive_reports_updated_at();

-- Deliverables table (create if not exists — referenced by pipeline)
-- This matches the pattern used by other deliverable types in the codebase
CREATE TABLE IF NOT EXISTS deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  type TEXT NOT NULL,           -- e.g. 'competitive_intel', 'listing_rewrite', 'social_post'
  title TEXT NOT NULL,
  content JSONB NOT NULL,       -- structured deliverable content
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'archived')),
  source_id UUID,               -- FK to source record (e.g. competitive_reports.id)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliverables_owner_id
  ON deliverables (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliverables_type
  ON deliverables (type, status);

CREATE OR REPLACE FUNCTION update_deliverables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deliverables_updated_at
  BEFORE UPDATE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION update_deliverables_updated_at();
