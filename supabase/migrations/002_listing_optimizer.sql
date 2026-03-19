-- Migration: 002_listing_optimizer
-- Adds listing optimization fields to properties table
-- and ensures agent_tasks table has all required columns.

-- ── properties table ──────────────────────────────────────────────────────────

-- Add optimized listing storage (jsonb for full structured output)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS optimized_listing       jsonb,
  ADD COLUMN IF NOT EXISTS optimization_run_at     timestamptz,
  ADD COLUMN IF NOT EXISTS optimization_approved   boolean    DEFAULT false,
  ADD COLUMN IF NOT EXISTS optimization_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS optimization_approved_by text;

-- Index for querying un-optimized properties (useful for batch runs)
CREATE INDEX IF NOT EXISTS idx_properties_optimization_run_at
  ON properties (optimization_run_at);

-- ── agent_tasks table ─────────────────────────────────────────────────────────
-- Extend the existing table (001_agent_tasks.sql already created it)

ALTER TABLE agent_tasks
  ADD COLUMN IF NOT EXISTS property_id   uuid REFERENCES properties(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS task_type     text,
  ADD COLUMN IF NOT EXISTS status        text    NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS input         jsonb,
  ADD COLUMN IF NOT EXISTS output        jsonb,
  ADD COLUMN IF NOT EXISTS token_cost    numeric(10,6),
  ADD COLUMN IF NOT EXISTS error         text,
  ADD COLUMN IF NOT EXISTS started_at    timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS duration_ms   integer;

-- Index for per-property task history
CREATE INDEX IF NOT EXISTS idx_agent_tasks_property_id
  ON agent_tasks (property_id);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_task_type_status
  ON agent_tasks (task_type, status);
