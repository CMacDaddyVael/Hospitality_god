-- =============================================================================
-- VAEL Host — Core Database Schema
-- Migration: 20260320000001_core_schema.sql
-- Created:   2026-03-20
--
-- This migration creates the foundational tables for the VAEL Host platform.
-- Every backend feature (scraper, scoring engine, auth, audit API, listing copy,
-- review responses) depends on these tables existing.
--
-- Tables created:
--   1. users          — STR owners who sign up for VAEL Host
--   2. listings       — Airbnb/Vrbo property URLs and scraped raw data
--   3. audits         — Scored analysis runs for a listing
--   4. audit_scores   — Per-category breakdown scores within an audit
--   5. deliverables   — AI-generated content ready for owner review/approval
--
-- Row-Level Security (RLS) is enabled on all tables so users can only
-- read and write their own rows. No cross-user data leakage is possible.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------------
-- pgcrypto gives us gen_random_uuid() for primary keys.
-- It is pre-installed on all Supabase projects; the IF NOT EXISTS guard
-- keeps the migration idempotent.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ---------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------------

-- Platform where the listing lives
CREATE TYPE listing_platform AS ENUM ('airbnb', 'vrbo');

-- Lifecycle state of an audit run
CREATE TYPE audit_status AS ENUM ('pending', 'complete', 'failed');

-- Kind of content the AI swarm can produce for an owner
CREATE TYPE deliverable_type AS ENUM (
  'listing_copy',       -- Rewritten title / description / tags
  'review_response',    -- Draft response to a guest review
  'social_post',        -- Instagram / TikTok caption + image brief
  'seasonal'            -- Seasonal copy or photo-set update
);

-- Owner action on a produced deliverable
CREATE TYPE deliverable_status AS ENUM (
  'pending',    -- Waiting for owner review
  'approved',   -- Owner accepted it (will use it)
  'dismissed'   -- Owner rejected / archived it
);


-- ---------------------------------------------------------------------------
-- 2. USERS
--
-- Mirrors auth.users (managed by Supabase Auth) but stores
-- VAEL-specific profile data, subscription tier, and preferences.
-- The id column is intentionally typed as uuid and references the
-- Supabase auth.users table so that login / JWT / RLS all work together.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  -- Primary key — same UUID that Supabase Auth assigns
  id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Contact & identity
  email           text        NOT NULL UNIQUE,
  full_name       text,

  -- Subscription state (mirrors Stripe)
  -- tier:  'free' = audit-only, 'pro' = $49/mo full swarm
  tier            text        NOT NULL DEFAULT 'free'
                              CHECK (tier IN ('free', 'pro', 'autopilot')),
  stripe_customer_id  text,
  stripe_subscription_id text,
  subscribed_at   timestamptz,
  subscription_expires_at timestamptz,

  -- Preferences / voice calibration blob (arbitrary JSON)
  -- Populated by the onboarding wizard and voice-calibration module.
  preferences     jsonb       NOT NULL DEFAULT '{}',

  -- Housekeeping
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.users IS
  'STR owners registered with VAEL Host. Mirrors auth.users and extends it '
  'with subscription state and owner preferences.';
COMMENT ON COLUMN public.users.id IS
  'UUID issued by Supabase Auth — used as the FK root for all user-owned rows.';
COMMENT ON COLUMN public.users.tier IS
  'Subscription tier: free (audit only) | pro ($49/mo) | autopilot ($149/mo future).';
COMMENT ON COLUMN public.users.preferences IS
  'Arbitrary JSON blob: voice calibration, notification settings, swarm focus areas, etc.';


-- ---------------------------------------------------------------------------
-- 3. LISTINGS
--
-- One row per property URL that an owner has connected to VAEL Host.
-- raw_data stores everything the scraper pulled from the listing page
-- (title, description, photos array, amenities, reviews, etc.) so
-- downstream agents can re-read it without re-scraping.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listings (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner who added this listing
  user_id         uuid            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Which booking platform this listing lives on
  platform        listing_platform NOT NULL,

  -- The canonical public URL of the listing (airbnb.com/rooms/... or vrbo.com/...)
  url             text            NOT NULL,

  -- Full JSON payload returned by the scraper (issue #105).
  -- Shape is flexible so the scraper can evolve without schema changes.
  -- Expected top-level keys: title, description, photos[], amenities[],
  --   reviews[], rating, review_count, property_type, location,
  --   price_per_night, bedrooms, bathrooms, max_guests
  raw_data        jsonb           NOT NULL DEFAULT '{}',

  -- Prevent the same owner from adding the same URL twice
  UNIQUE (user_id, url),

  created_at      timestamptz     NOT NULL DEFAULT now(),
  updated_at      timestamptz     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.listings IS
  'Airbnb / Vrbo property URLs submitted by owners, plus all raw scraped data.';
COMMENT ON COLUMN public.listings.platform IS
  'airbnb | vrbo — determines which scraper logic is used.';
COMMENT ON COLUMN public.listings.url IS
  'Canonical public URL. Unique per owner so the same property cannot be added twice.';
COMMENT ON COLUMN public.listings.raw_data IS
  'Full scraper output as JSONB. Treated as append-friendly; updated on each re-scrape.';


-- ---------------------------------------------------------------------------
-- 4. AUDITS
--
-- One row per audit run triggered for a listing.
-- An audit orchestrates the scoring engine (issue #106) and stores the
-- final overall score plus Claude's natural-language summary.
-- A listing may have many audits over time (initial + monthly re-audits).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audits (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which listing was audited
  listing_id      uuid            NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,

  -- Lifecycle: pending → complete | failed
  status          audit_status    NOT NULL DEFAULT 'pending',

  -- Aggregate score out of 100 (NULL while status = 'pending')
  overall_score   integer         CHECK (overall_score BETWEEN 0 AND 100),

  -- Claude's markdown-formatted summary of findings and recommendations.
  -- Shown on the audit report card.
  claude_summary  text,

  -- Optional: raw Claude API response envelope for debugging / audit trail
  claude_raw      jsonb,

  created_at      timestamptz     NOT NULL DEFAULT now(),
  updated_at      timestamptz     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.audits IS
  'One row per audit run. Stores lifecycle status, aggregate score (0-100), '
  'and Claude''s narrative summary.';
COMMENT ON COLUMN public.audits.status IS
  'pending = scoring in progress | complete = score ready | failed = error during analysis.';
COMMENT ON COLUMN public.audits.overall_score IS
  'Aggregate 0–100 score. NULL until status transitions to complete.';
COMMENT ON COLUMN public.audits.claude_summary IS
  'Human-readable markdown report from Claude. Shown on the free audit report card.';


-- ---------------------------------------------------------------------------
-- 5. AUDIT_SCORES
--
-- Per-category score breakdown for an audit.
-- Each row represents one scoring category (e.g. "Photos", "Title",
-- "Amenities", "Reviews") with its raw score, the maximum possible
-- score for that category, and optional notes from the scoring engine.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_scores (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent audit
  audit_id        uuid            NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,

  -- Human-readable category name, e.g. 'photos', 'title', 'description',
  -- 'amenities', 'reviews', 'pricing', 'response_rate'
  category        varchar(100)    NOT NULL,

  -- Raw score awarded for this category
  score           integer         NOT NULL CHECK (score >= 0),

  -- Maximum achievable score for this category
  -- (categories can have different weights, e.g. photos = 30, title = 15)
  max_score       integer         NOT NULL CHECK (max_score > 0),

  -- Qualitative notes: what's good, what needs fixing in this category
  notes           text,

  -- Prevent duplicate category rows within a single audit
  UNIQUE (audit_id, category),

  created_at      timestamptz     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.audit_scores IS
  'Per-category score rows for an audit. Drives the "report card" breakdown UI.';
COMMENT ON COLUMN public.audit_scores.category IS
  'Scoring category name: photos | title | description | amenities | '
  'reviews | pricing | response_rate | etc.';
COMMENT ON COLUMN public.audit_scores.score IS
  'Points awarded (0 … max_score).';
COMMENT ON COLUMN public.audit_scores.max_score IS
  'Maximum points possible for this category. Categories are weighted differently.';
COMMENT ON COLUMN public.audit_scores.notes IS
  'Free-text feedback from the scoring engine explaining the score.';


-- ---------------------------------------------------------------------------
-- 6. DELIVERABLES
--
-- AI-generated content items waiting for owner review.
-- The swarm produces deliverables continuously (daily/weekly); the owner
-- sees them in the dashboard, approves or dismisses each one, then
-- copy-pastes approved content into Airbnb/Instagram/etc.
--
-- content is a flexible JSONB blob whose shape varies by type:
--   listing_copy    → { title, description, tags[] }
--   review_response → { review_id, original_review, response_text }
--   social_post     → { caption, hashtags[], image_brief, platform }
--   seasonal        → { season, copy_updates{}, image_prompts[] }
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deliverables (
  id              uuid                PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner this deliverable belongs to
  user_id         uuid                NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Which listing this deliverable is for (nullable: some deliverables, e.g.
  -- general social posts, may not be tied to a specific listing)
  listing_id      uuid                REFERENCES public.listings(id) ON DELETE SET NULL,

  -- What kind of content this is
  type            deliverable_type    NOT NULL,

  -- Owner review state
  status          deliverable_status  NOT NULL DEFAULT 'pending',

  -- The actual AI-generated content. Shape depends on `type` — see above.
  content         jsonb               NOT NULL DEFAULT '{}',

  -- Optional: which audit triggered this deliverable (for traceability)
  audit_id        uuid                REFERENCES public.audits(id) ON DELETE SET NULL,

  created_at      timestamptz         NOT NULL DEFAULT now(),
  updated_at      timestamptz         NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.deliverables IS
  'AI-generated content items produced by the swarm for owner review. '
  'Owner approves or dismisses each item; approved items are copy-pasted externally.';
COMMENT ON COLUMN public.deliverables.type IS
  'listing_copy | review_response | social_post | seasonal';
COMMENT ON COLUMN public.deliverables.status IS
  'pending (awaiting review) | approved (owner accepted) | dismissed (owner rejected).';
COMMENT ON COLUMN public.deliverables.content IS
  'JSONB payload. Shape varies by type — see table comment for per-type schemas.';
COMMENT ON COLUMN public.deliverables.listing_id IS
  'NULL allowed — some deliverables (e.g. general social posts) are not listing-specific.';


-- ---------------------------------------------------------------------------
-- 7. INDEXES
-- ---------------------------------------------------------------------------

-- listings: fast lookup by owner
CREATE INDEX IF NOT EXISTS idx_listings_user_id
  ON public.listings (user_id);

-- audits: fast lookup by listing + recency
CREATE INDEX IF NOT EXISTS idx_audits_listing_id
  ON public.audits (listing_id);
CREATE INDEX IF NOT EXISTS idx_audits_listing_status
  ON public.audits (listing_id, status);

-- audit_scores: fast lookup by audit
CREATE INDEX IF NOT EXISTS idx_audit_scores_audit_id
  ON public.audit_scores (audit_id);

-- deliverables: common dashboard queries
CREATE INDEX IF NOT EXISTS idx_deliverables_user_id
  ON public.deliverables (user_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_user_status
  ON public.deliverables (user_id, status);
CREATE INDEX IF NOT EXISTS idx_deliverables_listing_id
  ON public.deliverables (listing_id)
  WHERE listing_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 8. UPDATED_AT TRIGGER
--
-- Automatically keeps updated_at in sync whenever a row is modified.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audits_updated_at
  BEFORE UPDATE ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_deliverables_updated_at
  BEFORE UPDATE ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 9. ROW-LEVEL SECURITY (RLS)
--
-- RLS ensures every authenticated user can ONLY see and modify rows that
-- belong to them.  No user can access another user's data — not even by
-- guessing a UUID.
--
-- Pattern used throughout:
--   auth.uid() = <user_id column>
--
-- For tables where user ownership is indirect (audits, audit_scores),
-- we join back through the ownership chain.
-- ---------------------------------------------------------------------------

-- ---- 9a. users ----
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- A user may read/update only their own profile row.
CREATE POLICY users_select_own
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY users_update_own
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insert is handled by the post-signup trigger (see note below);
-- we allow it here so the trigger / service role can create the row.
CREATE POLICY users_insert_own
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ---- 9b. listings ----
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY listings_select_own
  ON public.listings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY listings_insert_own
  ON public.listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY listings_update_own
  ON public.listings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY listings_delete_own
  ON public.listings FOR DELETE
  USING (auth.uid() = user_id);


-- ---- 9c. audits ----
-- Audits are owned indirectly: a user owns an audit if they own the
-- listing the audit belongs to.
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY audits_select_own
  ON public.audits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND l.user_id = auth.uid()
    )
  );

CREATE POLICY audits_insert_own
  ON public.audits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND l.user_id = auth.uid()
    )
  );

CREATE POLICY audits_update_own
  ON public.audits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND l.user_id = auth.uid()
    )
  );

CREATE POLICY audits_delete_own
  ON public.audits FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND l.user_id = auth.uid()
    )
  );


-- ---- 9d. audit_scores ----
-- audit_scores are owned two levels up: user → listing → audit → audit_score.
ALTER TABLE public.audit_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_scores_select_own
  ON public.audit_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.audits a
      JOIN public.listings l ON l.id = a.listing_id
      WHERE a.id = audit_id
        AND l.user_id = auth.uid()
    )
  );

CREATE POLICY audit_scores_insert_own
  ON public.audit_scores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.audits a
      JOIN public.listings l ON l.id = a.listing_id
      WHERE a.id = audit_id
        AND l.user_id = auth.uid()
    )
  );

CREATE POLICY audit_scores_update_own
  ON public.audit_scores FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.audits a
      JOIN public.listings l ON l.id = a.listing_id
      WHERE a.id = audit_id
        AND l.user_id = auth.uid()
    )
  );

CREATE POLICY audit_scores_delete_own
  ON public.audit_scores FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.audits a
      JOIN public.listings l ON l.id = a.listing_id
      WHERE a.id = audit_id
        AND l.user_id = auth.uid()
    )
  );


-- ---- 9e. deliverables ----
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY deliverables_select_own
  ON public.deliverables FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY deliverables_insert_own
  ON public.deliverables FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY deliverables_update_own
  ON public.deliverables FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY deliverables_delete_own
  ON public.deliverables FOR DELETE
  USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 10. SERVICE-ROLE BYPASS POLICIES
--
-- Background workers (scraper, scoring engine, Claude pipeline) run with
-- the Supabase service role key and need unrestricted write access.
-- Supabase's service role BYPASSES RLS by default — no extra policies needed.
-- These comments document that assumption explicitly so it isn't forgotten.
--
-- IF you ever switch to a restricted role for background workers, add
-- separate "service" policies here using a custom JWT claim, e.g.:
--   USING ( current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service' )
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 11. POST-SIGNUP TRIGGER
--
-- When a new user is created in auth.users (via Supabase Auth email/Google
-- sign-in), automatically insert a matching row in public.users so that
-- the rest of the app can join against it immediately.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- runs with elevated privileges to bypass RLS
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    -- Supabase stores display name in raw_user_meta_data->>'full_name'
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;   -- idempotent: safe to re-run
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
