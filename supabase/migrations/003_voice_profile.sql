-- Migration: Add voice_profile JSONB column to properties table
-- Issue #179 — Owner voice profile extraction
-- Additive only — no existing columns modified

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS voice_profile JSONB DEFAULT NULL;

-- Index for fast lookup when injecting into prompts
CREATE INDEX IF NOT EXISTS idx_properties_voice_profile
  ON properties USING GIN (voice_profile);

COMMENT ON COLUMN properties.voice_profile IS
  'Structured voice profile extracted from listing description and host review responses. '
  'Fields: tone, formality_score, characteristic_phrases, avoid_phrases, personality_markers, '
  'voice_profile_confidence, extracted_at. Populated during onboarding; low-confidence fallback '
  'applied for new/sparse hosts. See issue #179.';
