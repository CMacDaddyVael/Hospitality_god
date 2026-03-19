-- ============================================================
-- Hospitality God — Supersede Old Agent Tasks Migration
-- 20260319000003_drop_old_agent_tasks.sql
-- ============================================================
-- The earlier file supabase/migrations/001_agent_tasks.sql defined
-- a minimal agent_tasks table. This migration ensures the new
-- comprehensive schema is in place, dropping the old table if it
-- exists in the legacy form (missing required columns).
-- Safe to run multiple times (idempotent checks).
-- ============================================================

DO $$
BEGIN
  -- If agent_tasks exists but is missing 'owner_id' (old schema), drop and let
  -- migration 000001 recreate it. If 000001 already ran, this is a no-op.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agent_tasks'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_tasks'
      AND column_name = 'owner_id'
  ) THEN
    DROP TABLE IF EXISTS agent_tasks CASCADE;
    RAISE NOTICE 'Dropped legacy agent_tasks table — will be recreated by migration 000001';
  ELSE
    RAISE NOTICE 'agent_tasks table is current — no action needed';
  END IF;
END $$;
