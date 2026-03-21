-- Migration: Create leads and audits tables for free audit funnel
-- Issue #211: Marketing landing page + free audit entry point

-- Leads table: captures email submissions from the landing page
CREATE TABLE IF NOT EXISTS leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'organic_audit',
  listing_url TEXT,
  audit_id    UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookups by email
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email);

-- Index for lookups by source
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads (source);

-- Audits table: tracks the state of each free audit job
CREATE TABLE IF NOT EXISTS audits (
  id          UUID PRIMARY KEY,
  email       TEXT NOT NULL,
  listing_url TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'processing', 'complete', 'failed')),
  score       INTEGER,
  result      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookups by email
CREATE INDEX IF NOT EXISTS idx_audits_email ON audits (email);

-- Index for queue processing (workers pull queued audits)
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits (status, created_at);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audits_set_updated_at ON audits;
CREATE TRIGGER audits_set_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: these tables hold public-funnel data.
-- Service role key (used in the API route) bypasses RLS automatically.
-- No authenticated reads needed for the landing page flow.
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

-- Allow the service role full access (default Supabase behavior with service key)
-- Public: no direct read/write — all access goes through the API route
