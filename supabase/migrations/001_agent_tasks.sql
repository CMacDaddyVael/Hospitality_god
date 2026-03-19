-- Agent Tasks Queue
-- Core infrastructure for all autonomous agent actions

CREATE TYPE task_type_enum AS ENUM (
  'listing_analysis',
  'review_response',
  'guest_message',
  'social_post',
  'health_score'
);

CREATE TYPE task_status_enum AS ENUM (
  'pending',
  'running',
  'completed',
  'failed'
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL,
  task_type       task_type_enum NOT NULL,
  status          task_status_enum NOT NULL DEFAULT 'pending',
  payload         JSONB NOT NULL DEFAULT '{}',
  result          JSONB,
  scheduled_for   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempted_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the cron dispatcher query (hot path)
CREATE INDEX idx_agent_tasks_pending
  ON agent_tasks (status, scheduled_for, retry_count)
  WHERE status = 'pending';

-- Index for per-property concurrency check
CREATE INDEX idx_agent_tasks_property_running
  ON agent_tasks (property_id, status)
  WHERE status = 'running';

-- Index for dashboard activity feed
CREATE INDEX idx_agent_tasks_property_recent
  ON agent_tasks (property_id, created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_tasks_updated_at
  BEFORE UPDATE ON agent_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Activity log view for dashboard (surfaces failed + completed tasks)
CREATE OR REPLACE VIEW agent_task_activity AS
SELECT
  t.id,
  t.property_id,
  t.task_type,
  t.status,
  t.retry_count,
  t.error_message,
  t.scheduled_for,
  t.attempted_at,
  t.completed_at,
  t.created_at,
  CASE
    WHEN t.status = 'failed' AND t.retry_count >= 3 THEN
      CASE t.task_type
        WHEN 'listing_analysis'  THEN 'Listing analysis could not complete after 3 attempts. Please check your listing connection.'
        WHEN 'review_response'   THEN 'Review response failed to post after 3 attempts. The review may require manual action.'
        WHEN 'guest_message'     THEN 'Guest message could not be sent after 3 attempts. Please message your guest manually.'
        WHEN 'social_post'       THEN 'Social post failed to publish after 3 attempts. Check your Instagram/TikTok connection.'
        WHEN 'health_score'      THEN 'Health score calculation failed after 3 attempts. Dashboard data may be stale.'
        ELSE 'Task failed after 3 attempts. Please contact support.'
      END
    ELSE NULL
  END AS human_error_description
FROM agent_tasks t
ORDER BY t.created_at DESC;
