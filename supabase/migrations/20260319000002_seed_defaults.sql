-- ============================================================
-- Hospitality God — Seed / Default Data Migration
-- 20260319000002_seed_defaults.sql
-- ============================================================
-- This migration adds no user data — only system-level defaults
-- and ensures the schema is consistent for the dev environment.

-- ============================================================
-- Auto-create owner record when a user signs up via Supabase Auth
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.owners (id, email, subscription_tier, trial_ends_at, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'trial',
    NOW() + INTERVAL '14 days',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger fires after a new auth.users row is created
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Realtime subscriptions — enable for dashboard live updates
-- ============================================================

-- Allow Supabase Realtime to broadcast changes on these tables
-- (Tables must be added to the supabase_realtime publication)

DO $$
BEGIN
  -- Only add if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'agent_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'reviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'guest_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE guest_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'content_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE content_posts;
  END IF;
END $$;
