-- Migration: 002_jobs_table
-- Creates the jobs table used by the recurring swarm scheduler.
-- This is purely additive — no existing tables are modified.

CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL,
  job_type      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'done', 'failed')),
  payload       JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,

  -- Soft FK — subscribers table may be in auth schema or separate
  CONSTRAINT fk_subscriber
    FOREIGN KEY (subscriber_id)
    REFERENCES subscribers(id)
    ON DELETE CASCADE
);

-- Index for the scheduler's most common queries
CREATE INDEX IF NOT EXISTS idx_jobs_status          ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_subscriber_id   ON jobs (subscriber_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at      ON jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type        ON jobs (job_type);

-- Composite index for status dashboard (last 24h by status)
CREATE INDEX IF NOT EXISTS idx_jobs_created_status  ON jobs (created_at DESC, status);

COMMENT ON TABLE  jobs                IS 'Recurring swarm scheduler job queue — one row per agent task per subscriber per run';
COMMENT ON COLUMN jobs.subscriber_id  IS 'References subscribers.id — the paying user this job belongs to';
COMMENT ON COLUMN jobs.job_type       IS 'One of: review_scan | competitor_check | social_content | listing_optimization';
COMMENT ON COLUMN jobs.status         IS 'Lifecycle: queued → running → done | failed';
COMMENT ON COLUMN jobs.payload        IS 'Context passed to the worker: email, listing_url, preferences, scheduled_at, cadence';
COMMENT ON COLUMN jobs.error_message  IS 'Populated on failure — never silently discarded';
COMMENT ON COLUMN jobs.completed_at   IS 'Timestamp when status transitioned to done or failed';
