-- Migration 002: Add property_scores table for score history tracking
-- Additive only — does not alter any existing tables

CREATE TABLE IF NOT EXISTS property_scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  score         integer NOT NULL CHECK (score >= 0 AND score <= 100),
  category_scores jsonb NOT NULL DEFAULT '{}',
  scored_at     timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient time-series queries per property
CREATE INDEX IF NOT EXISTS idx_property_scores_property_id_scored_at
  ON property_scores (property_id, scored_at DESC);

-- Index for weekly re-score dedup check
CREATE INDEX IF NOT EXISTS idx_property_scores_scored_at
  ON property_scores (scored_at DESC);

COMMENT ON TABLE property_scores IS
  'Immutable audit score records — one row per scoring run per property. Never updated, only inserted.';
COMMENT ON COLUMN property_scores.property_id IS 'FK to properties table';
COMMENT ON COLUMN property_scores.score IS 'Overall score 0–100';
COMMENT ON COLUMN property_scores.category_scores IS 'JSONB map of category name → score, e.g. {"photos":72,"title":55}';
COMMENT ON COLUMN property_scores.scored_at IS 'UTC timestamp of when the score was computed';
