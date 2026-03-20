-- Migration 002: deliverables table for all VAEL Host deliverable types
-- This is ADDITIVE — does not modify any existing tables from migration 001

CREATE TABLE IF NOT EXISTS public.deliverables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID,                          -- optional FK to properties table
  session_id    TEXT,                          -- onboarding session reference
  type          TEXT NOT NULL,                 -- e.g. 'listing_optimization', 'review_response', 'social_post'
  status        TEXT NOT NULL DEFAULT 'pending_review',  -- pending_review | approved | rejected
  payload       JSONB NOT NULL DEFAULT '{}',   -- structured deliverable content
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by session (onboarding flow)
CREATE INDEX IF NOT EXISTS idx_deliverables_session_id
  ON public.deliverables (session_id);

-- Index for fast lookup by type (dashboard filtering)
CREATE INDEX IF NOT EXISTS idx_deliverables_type
  ON public.deliverables (type);

-- Index for status filtering (dashboard "pending review" queue)
CREATE INDEX IF NOT EXISTS idx_deliverables_status
  ON public.deliverables (status);

-- Composite index for most common dashboard query pattern
CREATE INDEX IF NOT EXISTS idx_deliverables_type_status
  ON public.deliverables (type, status);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deliverables_updated_at
  BEFORE UPDATE ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: Enable row-level security
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

-- Policy: service role has full access (used by server-side API routes)
CREATE POLICY "Service role full access"
  ON public.deliverables
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: anon can read their own session's deliverables
CREATE POLICY "Session owner read access"
  ON public.deliverables
  FOR SELECT
  TO anon
  USING (session_id IS NOT NULL);
