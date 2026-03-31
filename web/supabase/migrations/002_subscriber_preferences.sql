-- Migration: 002_subscriber_preferences
-- Creates subscriber_preferences and jobs tables for swarm activation
-- Additive only — does not modify any existing tables

-- ============================================================
-- TABLE: subscriber_preferences
-- Stores each subscriber's selected content modules and properties
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriber_preferences (
  subscriber_id   TEXT        PRIMARY KEY,
  modules         TEXT[]      NOT NULL DEFAULT '{}',
  property_urls   TEXT[]      NOT NULL DEFAULT '{}',
  voice_sample    TEXT        NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups by subscriber
CREATE INDEX IF NOT EXISTS idx_subscriber_preferences_subscriber_id
  ON public.subscriber_preferences (subscriber_id);

-- Row-level security: subscribers can only read their own preferences
ALTER TABLE public.subscriber_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "subscriber_preferences_select_own"
  ON public.subscriber_preferences
  FOR SELECT
  USING (auth.uid()::TEXT = subscriber_id);

CREATE POLICY IF NOT EXISTS "subscriber_preferences_insert_own"
  ON public.subscriber_preferences
  FOR INSERT
  WITH CHECK (auth.uid()::TEXT = subscriber_id);

CREATE POLICY IF NOT EXISTS "subscriber_preferences_update_own"
  ON public.subscriber_preferences
  FOR UPDATE
  USING (auth.uid()::TEXT = subscriber_id);

-- Service role bypasses RLS (used by webhook handler + activate endpoint)
-- This is Supabase default behavior with service_role key

-- ============================================================
-- TABLE: jobs
-- Enqueued swarm work items — one row per module × property
-- ============================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   TEXT        NOT NULL,
  module          TEXT        NOT NULL,
  property_url    TEXT        NOT NULL,
  cadence         TEXT        NOT NULL DEFAULT 'weekly',  -- 'daily' | 'weekly' | 'monthly'
  trigger         TEXT        NOT NULL DEFAULT 'cron',    -- 'cron' | 'immediate_activation'
  status          TEXT        NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'complete' | 'failed'
  result          JSONB       NULL,
  error           TEXT        NULL,
  scheduled_for   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ NULL,
  completed_at    TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for worker polling: find pending jobs ordered by scheduled_for
CREATE INDEX IF NOT EXISTS idx_jobs_status_scheduled
  ON public.jobs (status, scheduled_for ASC);

-- Index for idempotency check: find pending activation jobs for a subscriber
CREATE INDEX IF NOT EXISTS idx_jobs_subscriber_trigger_status
  ON public.jobs (subscriber_id, trigger, status);

-- Index for dashboard: all jobs for a subscriber
CREATE INDEX IF NOT EXISTS idx_jobs_subscriber_id
  ON public.jobs (subscriber_id, created_at DESC);

-- Row-level security
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "jobs_select_own"
  ON public.jobs
  FOR SELECT
  USING (auth.uid()::TEXT = subscriber_id);

-- ============================================================
-- FUNCTION: update_updated_at_column
-- Auto-updates the updated_at column on subscriber_preferences
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_subscriber_preferences_updated_at
  ON public.subscriber_preferences;

CREATE TRIGGER set_subscriber_preferences_updated_at
  BEFORE UPDATE ON public.subscriber_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
