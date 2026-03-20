-- Migration: 002_deliverables
-- Creates the deliverables table for storing agent-generated content packages
-- that surface in the dashboard approval queue.
--
-- Each row is one unit of approvable content (social post, listing rewrite, etc.)
-- produced by the VAEL agent swarm for a specific listing and week.

CREATE TABLE IF NOT EXISTS deliverables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL,
  user_id     UUID NOT NULL,

  -- Content type: 'social_post' | 'listing_rewrite' | 'review_response' | 'seasonal_update'
  type        TEXT NOT NULL,

  -- Approval workflow: 'pending' | 'approved' | 'rejected' | 'posted'
  status      TEXT NOT NULL DEFAULT 'pending',

  -- The week this content was generated for (Monday ISO date: YYYY-MM-DD)
  week_of     DATE,

  -- Flexible JSONB payload — schema varies by type.
  -- For social_post: { caption, hashtags, hook, image_brief, listing_title, listing_location, generated_at }
  content     JSONB NOT NULL DEFAULT '{}',

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the dashboard approval queue (user sees their pending deliverables)
CREATE INDEX IF NOT EXISTS deliverables_user_status_idx
  ON deliverables (user_id, status, created_at DESC);

-- Index for listing-specific queries
CREATE INDEX IF NOT EXISTS deliverables_listing_idx
  ON deliverables (listing_id, type, week_of DESC);

-- Index for the upsert existence check in generateSocialPostPackage
CREATE INDEX IF NOT EXISTS deliverables_upsert_check_idx
  ON deliverables (listing_id, user_id, type, week_of);

-- Trigger to auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_deliverables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deliverables_updated_at_trigger
  BEFORE UPDATE ON deliverables
  FOR EACH ROW
  EXECUTE FUNCTION update_deliverables_updated_at();

-- Optional: add FK references if listings and users tables exist with UUID PKs
-- ALTER TABLE deliverables ADD CONSTRAINT fk_deliverables_listing
--   FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
-- ALTER TABLE deliverables ADD CONSTRAINT fk_deliverables_user
--   FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON TABLE deliverables IS
  'Agent-generated content packages awaiting owner review and approval. '
  'Each row is one deliverable surfaced in the dashboard queue.';

COMMENT ON COLUMN deliverables.type IS
  'Content type: social_post | listing_rewrite | review_response | seasonal_update';

COMMENT ON COLUMN deliverables.status IS
  'Approval state: pending | approved | rejected | posted';

COMMENT ON COLUMN deliverables.week_of IS
  'ISO week start date (Monday) the content was generated for';

COMMENT ON COLUMN deliverables.content IS
  'JSONB payload. For social_post: { caption, hashtags, hook, image_brief, listing_title, listing_location, generated_at }';
