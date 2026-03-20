-- ============================================================
-- VAEL Host — Auto-create owner row on auth signup
-- Migration: 20260320000003_create_owner_on_signup
-- ============================================================
-- Trigger fires after a new user is inserted into auth.users,
-- automatically creating a corresponding owners row so every
-- authenticated user has a profile without extra client calls.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.owners (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create a default free subscription for every new owner
  INSERT INTO public.subscriptions (owner_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (owner_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Attach to auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
