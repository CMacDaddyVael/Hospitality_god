-- Migration: Add profiles table and wire auth to audits
-- Issue #107: Supabase Auth wiring

-- ============================================================
-- profiles table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id  TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'free'
                        CHECK (subscription_status IN ('free', 'active', 'past_due', 'canceled', 'trialing')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Automatically create a profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- audits table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- nullable until user creates an account and claims the audit
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- anonymous session token so we can claim the audit after signup
  session_token   TEXT NOT NULL,
  listing_url     TEXT NOT NULL,
  score           INTEGER,
  score_breakdown JSONB,
  listing_data    JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audits_user_id_idx      ON public.audits(user_id);
CREATE INDEX IF NOT EXISTS audits_session_token_idx ON public.audits(session_token);

-- RLS
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

-- Anon users can insert (running the free audit)
CREATE POLICY "Anyone can create an audit"
  ON public.audits FOR INSERT
  WITH CHECK (true);

-- Anon users can read audits by session_token (teaser view)
CREATE POLICY "Session owner can read own audit"
  ON public.audits FOR SELECT
  USING (
    session_token = current_setting('request.jwt.claims', true)::jsonb->>'session_token'
    OR auth.uid() = user_id
  );

-- Authenticated users can claim their audit (set user_id)
CREATE POLICY "Users can claim their own audit"
  ON public.audits FOR UPDATE
  USING (session_token IS NOT NULL)
  WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audits_set_updated_at ON public.audits;
CREATE TRIGGER audits_set_updated_at
  BEFORE UPDATE ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
