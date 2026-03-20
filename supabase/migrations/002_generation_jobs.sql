-- Migration: generation_jobs table and supporting structures
-- Issue #127: Build deliverable generation queue and scheduler

-- ============================================================
-- generation_jobs: the core queue table
-- ============================================================
CREATE TABLE IF NOT EXISTS generation_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id        TEXT,                        -- platform listing ID (e.g. Airbnb room ID)
  job_type          TEXT NOT NULL,               -- 'social_post' | 'listing_copy' | 'review_response' | 'seasonal_update' | 'guest_message'
  status            TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'complete' | 'failed'
  priority          INTEGER NOT NULL DEFAULT 5,  -- 1 (highest) – 10 (lowest)
  payload           JSONB,                       -- arbitrary context for the worker
  result            JSONB,                       -- output from the worker
  error_message     TEXT,
  retry_count       INTEGER NOT NULL DEFAULT 0,
  max_retries       INTEGER NOT NULL DEFAULT 3,
  next_retry_at     TIMESTAMPTZ,
  scheduled_for     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the worker poll query
CREATE INDEX IF NOT EXISTS idx_generation_jobs_pending
  ON generation_jobs (status, scheduled_for, priority)
  WHERE status IN ('pending', 'failed');

-- Index for per-user queries (dashboard)
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user
  ON generation_jobs (user_id, created_at DESC);

-- Index for daily run summary queries
CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at
  ON generation_jobs (created_at);

-- ============================================================
-- scheduler_run_log: admin-visible daily run summary
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduler_run_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date        DATE NOT NULL,
  run_type        TEXT NOT NULL DEFAULT 'daily',  -- 'daily' | 'manual'
  users_evaluated INTEGER NOT NULL DEFAULT 0,
  jobs_queued     INTEGER NOT NULL DEFAULT 0,
  jobs_completed  INTEGER NOT NULL DEFAULT 0,
  jobs_failed     INTEGER NOT NULL DEFAULT 0,
  duration_ms     INTEGER,
  error_message   TEXT,
  status          TEXT NOT NULL DEFAULT 'running', -- 'running' | 'complete' | 'failed'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scheduler_run_log_date
  ON scheduler_run_log (run_date DESC);

-- ============================================================
-- deliverable_cadence: per-user module configuration
-- Stores which modules are enabled and how often to run them
-- ============================================================
CREATE TABLE IF NOT EXISTS deliverable_cadence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module          TEXT NOT NULL,      -- 'social_post' | 'listing_copy' | 'review_response' | 'seasonal_update' | 'guest_message'
  cadence         TEXT NOT NULL DEFAULT 'weekly', -- 'daily' | 'weekly' | 'monthly'
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  last_generated_at TIMESTAMPTZ,
  listing_id      TEXT,               -- optional: scope to a specific listing
  config          JSONB,              -- module-specific settings (e.g. tone, platform)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, module, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_deliverable_cadence_user
  ON deliverable_cadence (user_id);

-- ============================================================
-- updated_at trigger helper
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generation_jobs_updated_at
  BEFORE UPDATE ON generation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_deliverable_cadence_updated_at
  BEFORE UPDATE ON deliverable_cadence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverable_cadence ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_run_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own jobs
CREATE POLICY "Users can view own generation jobs"
  ON generation_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (scheduler / worker run as service role)
CREATE POLICY "Service role full access to generation_jobs"
  ON generation_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read/update their own cadence config
CREATE POLICY "Users can manage own deliverable cadence"
  ON deliverable_cadence FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to deliverable_cadence"
  ON deliverable_cadence FOR ALL
  USING (auth.role() = 'service_role');

-- Scheduler run log is admin/service-role only for writes; readable by authenticated users
CREATE POLICY "Authenticated users can read scheduler run log"
  ON scheduler_run_log FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "Service role full access to scheduler_run_log"
  ON scheduler_run_log FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Seed default cadence rows for any existing active subscribers
-- (safe to re-run — INSERT ... ON CONFLICT DO NOTHING)
-- ============================================================
-- This is intentionally left as a comment; run via the scheduler's
-- ensureDefaultCadence() helper so it has access to actual user IDs.
