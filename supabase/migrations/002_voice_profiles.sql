-- Migration: Create voice_profiles table for owner voice/personality storage
-- Issue #121: Owner voice capture API

CREATE TABLE IF NOT EXISTS voice_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL UNIQUE,
  raw_answers   JSONB NOT NULL DEFAULT '{}',
  profile_summary TEXT NOT NULL DEFAULT '',
  tone_tags     TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by user_id (also enforced unique above)
CREATE INDEX IF NOT EXISTS idx_voice_profiles_user_id ON voice_profiles(user_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_voice_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_voice_profiles_updated_at
  BEFORE UPDATE ON voice_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_profiles_updated_at();

COMMENT ON TABLE voice_profiles IS 'Stores owner voice/tone profiles extracted from onboarding interview answers. Used to personalize all AI-generated content.';
COMMENT ON COLUMN voice_profiles.user_id IS 'FK to auth.users — one profile per owner';
COMMENT ON COLUMN voice_profiles.raw_answers IS 'Raw JSON answers from the onboarding voice interview (q1..q7)';
COMMENT ON COLUMN voice_profiles.profile_summary IS '2-3 sentence AI-generated summary of the owner voice/tone';
COMMENT ON COLUMN voice_profiles.tone_tags IS 'Array of 3-5 tone descriptor tags, e.g. ["warm","witty","coastal"]';
