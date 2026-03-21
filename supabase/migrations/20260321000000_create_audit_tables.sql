-- Migration: create_audit_tables
-- Issue #223 — Audit results persistence layer
-- Created by Worker Agent on 2026-03-21
--
-- Creates two tables:
--   listing_audits  — one row per audit run (header + overall score)
--   audit_findings  — one row per individual finding within an audit
--
-- Design notes:
--   • listing_audits.id uses gen_random_uuid() so IDs are opaque and
--     safe to expose in dashboard URLs.
--   • category_scores is stored as JSONB so the scoring engine can add
--     new categories without a schema migration.
--   • overall_score is a smallint (0-100) — enforced by CHECK constraint.
--   • severity is an enum-like text column constrained to low/medium/high.
--   • All timestamps are timestamptz (UTC-aware).
--   • RLS is enabled on both tables; policies allow service-role full access
--     and authenticated users to read only their own rows.

-- ---------------------------------------------------------------------------
-- listing_audits
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS listing_audits (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The public listing URL that was scraped
  listing_url      TEXT        NOT NULL,

  -- Platform-specific ID extracted from the URL (nullable — not always available)
  listing_id       TEXT,

  -- Owner identifier — normalised to lowercase on write
  owner_email      TEXT        NOT NULL,

  -- Composite score 0-100
  overall_score    SMALLINT    NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),

  -- Per-category breakdown stored as JSONB, e.g.:
  --   [{"category": "photos", "score": 55}, {"category": "title", "score": 80}]
  -- Nullable — not all scoring engine versions emit this.
  category_scores  JSONB,

  -- When the listing was actually scraped (may differ from created_at if
  -- results are stored with a delay)
  scraped_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Row creation timestamp
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the two primary access patterns
CREATE INDEX IF NOT EXISTS idx_listing_audits_owner_email
  ON listing_audits (owner_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_audits_listing_url
  ON listing_audits (listing_url, created_at DESC);

-- ---------------------------------------------------------------------------
-- audit_findings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_findings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to the parent audit
  audit_id             UUID        NOT NULL REFERENCES listing_audits(id) ON DELETE CASCADE,

  -- Scoring category: photos, title, description, amenities, pricing, reviews, etc.
  category             TEXT        NOT NULL,

  -- Human-readable description of the issue found
  finding_text         TEXT        NOT NULL,

  -- Triage severity
  severity             TEXT        NOT NULL DEFAULT 'medium'
                                   CHECK (severity IN ('low', 'medium', 'high')),

  -- Actionable recommendation shown to the owner
  recommendation_text  TEXT        NOT NULL DEFAULT '',

  -- Row creation timestamp
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Efficient lookup of all findings for a given audit
CREATE INDEX IF NOT EXISTS idx_audit_findings_audit_id
  ON audit_findings (audit_id);

-- Allow filtering findings by severity across all audits for a user
-- (useful for "show me all high-severity issues" dashboard view)
CREATE INDEX IF NOT EXISTS idx_audit_findings_severity
  ON audit_findings (severity);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE listing_audits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings   ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS entirely (used by backend workers)
-- (Supabase service_role key always bypasses RLS — no policy needed)

-- Authenticated users can read their own audit rows
CREATE POLICY "Users can read own audits"
  ON listing_audits
  FOR SELECT
  TO authenticated
  USING (owner_email = lower(auth.jwt() ->> 'email'));

-- Authenticated users can read findings that belong to their audits
CREATE POLICY "Users can read findings for own audits"
  ON audit_findings
  FOR SELECT
  TO authenticated
  USING (
    audit_id IN (
      SELECT id FROM listing_audits
      WHERE owner_email = lower(auth.jwt() ->> 'email')
    )
  );

-- ---------------------------------------------------------------------------
-- Helpful view: latest audit per email (used by dashboard home card)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW latest_audit_per_owner AS
SELECT DISTINCT ON (owner_email)
  id,
  owner_email,
  listing_url,
  listing_id,
  overall_score,
  category_scores,
  scraped_at,
  created_at
FROM listing_audits
ORDER BY owner_email, created_at DESC;

COMMENT ON VIEW latest_audit_per_owner IS
  'One row per owner showing their most recent audit — used by the dashboard home card.';

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

COMMENT ON TABLE listing_audits IS
  'One row per audit run. Stores the listing URL, owner email, and overall score. '
  'Drives the score-over-time chart and is the parent for audit_findings rows.';

COMMENT ON TABLE audit_findings IS
  'Individual findings from a single audit run. Many findings per listing_audits row. '
  'Each finding has a category, human-readable description, severity, and recommended fix.';

COMMENT ON COLUMN listing_audits.category_scores IS
  'JSONB array of per-category scores: [{category: string, score: number}]. '
  'Nullable — older audit engine versions may not emit this field.';

COMMENT ON COLUMN listing_audits.scraped_at IS
  'Timestamp of when the listing was actually scraped. May differ from created_at '
  'if results are batched or stored after a delay.';
