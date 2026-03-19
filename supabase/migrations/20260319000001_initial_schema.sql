-- ============================================================
-- Hospitality God — MVP Database Schema
-- Migration: 20260319000001_initial_schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT,
  avatar_url      TEXT,
  phone           TEXT,
  timezone        TEXT NOT NULL DEFAULT 'America/New_York',
  onboarding_step TEXT NOT NULL DEFAULT 'listing_url',
  onboarding_completed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'Owner/operator profiles, extending Supabase auth.users';

-- ============================================================
-- PROPERTIES
-- ============================================================
CREATE TABLE public.properties (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Basic info
  name            TEXT NOT NULL,
  description     TEXT,
  property_type   TEXT NOT NULL DEFAULT 'entire_place',
  -- entire_place | private_room | shared_room | hotel_room | boutique_hotel | resort

  -- Location
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT NOT NULL,
  state           TEXT,
  country         TEXT NOT NULL DEFAULT 'US',
  zip_code        TEXT,
  latitude        NUMERIC(10, 7),
  longitude       NUMERIC(10, 7),

  -- Specs
  bedrooms        SMALLINT NOT NULL DEFAULT 1,
  bathrooms       NUMERIC(3,1) NOT NULL DEFAULT 1,
  max_guests      SMALLINT NOT NULL DEFAULT 2,
  square_feet     INTEGER,

  -- Media
  photos          TEXT[] NOT NULL DEFAULT '{}',
  cover_photo_url TEXT,

  -- AI-generated voice/brand
  owner_voice     JSONB NOT NULL DEFAULT '{}',
  -- { tone, signOffName, alwaysUse, neverUse, personalityNotes }

  -- Health score (computed by agent)
  listing_health_score SMALLINT CHECK (listing_health_score BETWEEN 0 AND 100),
  health_score_updated_at TIMESTAMPTZ,

  -- Status
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.properties IS 'Core property records — supports 1-50 properties per owner';
CREATE INDEX idx_properties_owner_id ON public.properties(owner_id);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TYPE subscription_plan AS ENUM ('starter', 'pro', 'agency');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid');

CREATE TABLE public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Stripe
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id       TEXT,

  plan                  subscription_plan NOT NULL DEFAULT 'starter',
  status                subscription_status NOT NULL DEFAULT 'trialing',
  billing_cycle         TEXT NOT NULL DEFAULT 'monthly', -- monthly | annual

  trial_ends_at         TIMESTAMPTZ,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  canceled_at           TIMESTAMPTZ,

  -- Limits
  max_properties        SMALLINT NOT NULL DEFAULT 1,
  -- starter=1, pro=5, agency=50

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.subscriptions IS 'Stripe subscription records per owner';
CREATE INDEX idx_subscriptions_owner_id ON public.subscriptions(owner_id);
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

-- ============================================================
-- LISTINGS (Airbnb / Vrbo platform connections)
-- ============================================================
CREATE TYPE listing_platform AS ENUM ('airbnb', 'vrbo');

CREATE TABLE public.listings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id         UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  platform            listing_platform NOT NULL,
  external_listing_id TEXT NOT NULL,
  listing_url         TEXT NOT NULL,

  -- Current content (as fetched from platform)
  current_title       TEXT,
  current_description TEXT,
  current_price_per_night NUMERIC(10,2),
  current_photos      TEXT[] NOT NULL DEFAULT '{}',
  current_tags        TEXT[] NOT NULL DEFAULT '{}',
  current_rating      NUMERIC(3,2),
  current_review_count INTEGER NOT NULL DEFAULT 0,

  -- AI-optimized content (pending or applied)
  optimized_title     TEXT,
  optimized_description TEXT,
  optimization_status TEXT NOT NULL DEFAULT 'pending',
  -- pending | analyzing | draft_ready | applied | skipped

  -- Sync state
  last_synced_at      TIMESTAMPTZ,
  sync_error          TEXT,

  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(platform, external_listing_id)
);

COMMENT ON TABLE public.listings IS 'Platform-specific listing records (Airbnb/Vrbo) linked to properties';
CREATE INDEX idx_listings_property_id ON public.listings(property_id);
CREATE INDEX idx_listings_owner_id ON public.listings(owner_id);
CREATE INDEX idx_listings_platform ON public.listings(platform);
CREATE INDEX idx_listings_last_synced ON public.listings(last_synced_at);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TYPE review_platform AS ENUM ('airbnb', 'vrbo', 'google', 'tripadvisor', 'booking');
CREATE TYPE response_status AS ENUM ('pending', 'draft_ready', 'approved', 'posted', 'skipped', 'failed');

CREATE TABLE public.reviews (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id           UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  listing_id            UUID REFERENCES public.listings(id) ON DELETE SET NULL,

  platform              review_platform NOT NULL,
  external_review_id    TEXT,

  -- Guest info
  guest_name            TEXT NOT NULL,
  guest_avatar_url      TEXT,

  -- Review content
  rating                SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text           TEXT NOT NULL,
  review_categories     JSONB NOT NULL DEFAULT '{}',
  -- { cleanliness, accuracy, checkin, communication, location, value }

  -- AI response
  response_text         TEXT,
  response_status       response_status NOT NULL DEFAULT 'pending',
  response_posted_at    TIMESTAMPTZ,
  response_approved_at  TIMESTAMPTZ,

  -- Sentiment (computed by AI)
  sentiment             TEXT, -- positive | neutral | negative
  sentiment_score       NUMERIC(4,3), -- -1.0 to 1.0
  key_themes            TEXT[] NOT NULL DEFAULT '{}',

  -- Timestamps
  reviewed_at           TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(platform, external_review_id)
);

COMMENT ON TABLE public.reviews IS 'Guest reviews from all platforms with AI response tracking';
CREATE INDEX idx_reviews_property_id ON public.reviews(property_id);
CREATE INDEX idx_reviews_owner_id ON public.reviews(owner_id);
CREATE INDEX idx_reviews_platform ON public.reviews(platform);
CREATE INDEX idx_reviews_response_status ON public.reviews(response_status);
CREATE INDEX idx_reviews_rating ON public.reviews(rating);
CREATE INDEX idx_reviews_reviewed_at ON public.reviews(reviewed_at DESC);

-- ============================================================
-- REVIEW RESPONSES (version history)
-- ============================================================
CREATE TABLE public.review_responses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id       UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  response_text   TEXT NOT NULL,
  version         SMALLINT NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Generation metadata
  generated_by    TEXT NOT NULL DEFAULT 'ai', -- ai | human | ai_edited
  ai_model        TEXT,
  prompt_version  TEXT,

  approved_at     TIMESTAMPTZ,
  posted_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.review_responses IS 'Version history of AI-generated and human-edited review responses';
CREATE INDEX idx_review_responses_review_id ON public.review_responses(review_id);
CREATE INDEX idx_review_responses_owner_id ON public.review_responses(owner_id);

-- ============================================================
-- MESSAGE SEQUENCES (templates / automation flows)
-- ============================================================
CREATE TYPE sequence_type AS ENUM (
  'pre_arrival',
  'check_in',
  'mid_stay',
  'checkout_reminder',
  'post_stay_thanks',
  'review_request',
  'custom'
);

CREATE TABLE public.message_sequences (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  sequence_type   sequence_type NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,

  -- Trigger configuration
  trigger_event   TEXT NOT NULL,
  -- booking_confirmed | checkin_day | checkout_day | days_before_checkin | days_after_checkout
  trigger_offset_hours INTEGER NOT NULL DEFAULT 0,
  -- positive = after event, negative = before event

  -- Message template
  subject         TEXT,
  message_body    TEXT NOT NULL,

  -- Status
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(property_id, sequence_type)
);

COMMENT ON TABLE public.message_sequences IS 'Automated guest message templates per property and trigger event';
CREATE INDEX idx_message_sequences_property_id ON public.message_sequences(property_id);
CREATE INDEX idx_message_sequences_owner_id ON public.message_sequences(owner_id);

-- ============================================================
-- GUEST MESSAGES (individual sent/scheduled messages)
-- ============================================================
CREATE TYPE message_status AS ENUM ('scheduled', 'sending', 'sent', 'failed', 'canceled');
CREATE TYPE message_channel AS ENUM ('airbnb', 'vrbo', 'sms', 'email', 'whatsapp');

CREATE TABLE public.guest_messages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id         UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sequence_id         UUID REFERENCES public.message_sequences(id) ON DELETE SET NULL,

  -- Guest info
  guest_name          TEXT NOT NULL,
  guest_email         TEXT,
  guest_phone         TEXT,
  reservation_id      TEXT, -- external booking ID

  -- Message content
  sequence_type       sequence_type NOT NULL,
  trigger_event       TEXT NOT NULL,
  channel             message_channel NOT NULL DEFAULT 'airbnb',
  subject             TEXT,
  message_body        TEXT NOT NULL,

  -- Scheduling
  scheduled_at        TIMESTAMPTZ NOT NULL,
  sent_at             TIMESTAMPTZ,

  -- Status
  status              message_status NOT NULL DEFAULT 'scheduled',
  error_message       TEXT,
  retry_count         SMALLINT NOT NULL DEFAULT 0,

  -- Metadata
  is_ai_generated     BOOLEAN NOT NULL DEFAULT TRUE,
  personalization_data JSONB NOT NULL DEFAULT '{}',
  -- { checkinDate, checkoutDate, propertyName, guestFirstName, ... }

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.guest_messages IS 'Individual guest messages — scheduled, sent, or failed';
CREATE INDEX idx_guest_messages_property_id ON public.guest_messages(property_id);
CREATE INDEX idx_guest_messages_owner_id ON public.guest_messages(owner_id);
CREATE INDEX idx_guest_messages_status ON public.guest_messages(status);
CREATE INDEX idx_guest_messages_scheduled_at ON public.guest_messages(scheduled_at);
CREATE INDEX idx_guest_messages_reservation ON public.guest_messages(reservation_id);

-- ============================================================
-- SOCIAL POSTS
-- ============================================================
CREATE TYPE social_platform AS ENUM ('instagram', 'tiktok', 'facebook', 'twitter', 'pinterest');
CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'published', 'failed', 'canceled');

CREATE TABLE public.social_posts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id       UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  platform          social_platform NOT NULL,

  -- Content
  caption           TEXT NOT NULL,
  hashtags          TEXT[] NOT NULL DEFAULT '{}',
  media_urls        TEXT[] NOT NULL DEFAULT '{}',
  media_type        TEXT NOT NULL DEFAULT 'image', -- image | video | carousel | reel

  -- AI generation
  content_theme     TEXT, -- seasonal | amenity_spotlight | local_area | review_highlight | lifestyle
  ai_prompt_used    TEXT,
  ai_model          TEXT,

  -- Scheduling
  scheduled_at      TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,

  -- Status
  status            post_status NOT NULL DEFAULT 'draft',
  error_message     TEXT,

  -- Platform-specific
  external_post_id  TEXT, -- ID returned by platform API after publishing
  platform_account_id TEXT,

  -- Analytics (populated after publishing)
  likes_count       INTEGER,
  comments_count    INTEGER,
  shares_count      INTEGER,
  reach_count       INTEGER,
  impressions_count INTEGER,
  analytics_updated_at TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.social_posts IS 'AI-generated social media posts for Instagram/TikTok';
CREATE INDEX idx_social_posts_property_id ON public.social_posts(property_id);
CREATE INDEX idx_social_posts_owner_id ON public.social_posts(owner_id);
CREATE INDEX idx_social_posts_platform ON public.social_posts(platform);
CREATE INDEX idx_social_posts_status ON public.social_posts(status);
CREATE INDEX idx_social_posts_scheduled_at ON public.social_posts(scheduled_at);

-- ============================================================
-- AGENT TASKS
-- ============================================================
CREATE TYPE task_type AS ENUM (
  'listing_analysis',
  'listing_optimization',
  'review_response',
  'review_post',
  'guest_message',
  'social_content',
  'health_score',
  'voice_calibration',
  'sync_listing',
  'sync_reviews',
  'competitive_analysis'
);

CREATE TYPE task_status AS ENUM ('pending', 'running', 'completed', 'failed', 'canceled');

CREATE TABLE public.agent_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES public.properties(id) ON DELETE CASCADE,

  -- Task identity
  task_type       task_type NOT NULL,
  task_key        TEXT,
  -- Deduplication key, e.g. "review_response:review_uuid"

  -- Status tracking
  status          task_status NOT NULL DEFAULT 'pending',
  retry_count     SMALLINT NOT NULL DEFAULT 0,
  max_retries     SMALLINT NOT NULL DEFAULT 3,

  -- Payload and results
  input_data      JSONB NOT NULL DEFAULT '{}',
  output_data     JSONB NOT NULL DEFAULT '{}',
  error_message   TEXT,
  error_stack     TEXT,

  -- Timing
  priority        SMALLINT NOT NULL DEFAULT 5, -- 1 (highest) to 10 (lowest)
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  next_retry_at   TIMESTAMPTZ,

  -- AI metadata
  ai_model        TEXT,
  tokens_used     INTEGER,
  cost_usd        NUMERIC(10,6),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.agent_tasks IS 'Autonomous agent task queue with retry logic and full audit trail';
CREATE INDEX idx_agent_tasks_owner_id ON public.agent_tasks(owner_id);
CREATE INDEX idx_agent_tasks_property_id ON public.agent_tasks(property_id);
CREATE INDEX idx_agent_tasks_status ON public.agent_tasks(status);
CREATE INDEX idx_agent_tasks_task_type ON public.agent_tasks(task_type);
CREATE INDEX idx_agent_tasks_scheduled_at ON public.agent_tasks(scheduled_at);
CREATE INDEX idx_agent_tasks_task_key ON public.agent_tasks(task_key) WHERE task_key IS NOT NULL;
-- Composite index for the worker queue query
CREATE INDEX idx_agent_tasks_queue ON public.agent_tasks(status, priority, scheduled_at)
  WHERE status IN ('pending', 'failed');

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_message_sequences_updated_at
  BEFORE UPDATE ON public.message_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_guest_messages_updated_at
  BEFORE UPDATE ON public.guest_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_agent_tasks_updated_at
  BEFORE UPDATE ON public.agent_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

-- ── users ──────────────────────────────────────────────────
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- ── properties ─────────────────────────────────────────────
CREATE POLICY "properties_select_own" ON public.properties
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "properties_insert_own" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "properties_update_own" ON public.properties
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "properties_delete_own" ON public.properties
  FOR DELETE USING (auth.uid() = owner_id);

-- ── subscriptions ──────────────────────────────────────────
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "subscriptions_insert_own" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "subscriptions_update_own" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = owner_id);

-- ── listings ───────────────────────────────────────────────
CREATE POLICY "listings_select_own" ON public.listings
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "listings_insert_own" ON public.listings
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "listings_update_own" ON public.listings
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "listings_delete_own" ON public.listings
  FOR DELETE USING (auth.uid() = owner_id);

-- ── reviews ────────────────────────────────────────────────
CREATE POLICY "reviews_select_own" ON public.reviews
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "reviews_insert_own" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "reviews_update_own" ON public.reviews
  FOR UPDATE USING (auth.uid() = owner_id);

-- ── review_responses ───────────────────────────────────────
CREATE POLICY "review_responses_select_own" ON public.review_responses
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "review_responses_insert_own" ON public.review_responses
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "review_responses_update_own" ON public.review_responses
  FOR UPDATE USING (auth.uid() = owner_id);

-- ── message_sequences ──────────────────────────────────────
CREATE POLICY "message_sequences_select_own" ON public.message_sequences
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "message_sequences_insert_own" ON public.message_sequences
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "message_sequences_update_own" ON public.message_sequences
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "message_sequences_delete_own" ON public.message_sequences
  FOR DELETE USING (auth.uid() = owner_id);

-- ── guest_messages ─────────────────────────────────────────
CREATE POLICY "guest_messages_select_own" ON public.guest_messages
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "guest_messages_insert_own" ON public.guest_messages
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "guest_messages_update_own" ON public.guest_messages
  FOR UPDATE USING (auth.uid() = owner_id);

-- ── social_posts ───────────────────────────────────────────
CREATE POLICY "social_posts_select_own" ON public.social_posts
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "social_posts_insert_own" ON public.social_posts
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "social_posts_update_own" ON public.social_posts
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "social_posts_delete_own" ON public.social_posts
  FOR DELETE USING (auth.uid() = owner_id);

-- ── agent_tasks ────────────────────────────────────────────
CREATE POLICY "agent_tasks_select_own" ON public.agent_tasks
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "agent_tasks_insert_own" ON public.agent_tasks
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "agent_tasks_update_own" ON public.agent_tasks
  FOR UPDATE USING (auth.uid() = owner_id);

-- ============================================================
-- SERVICE ROLE BYPASS (for server-side workers)
-- Workers use service_role key which bypasses RLS by default
-- in Supabase. No extra policies needed.
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Get pending agent tasks for worker processing
CREATE OR REPLACE FUNCTION public.claim_next_agent_tasks(
  p_limit INTEGER DEFAULT 5
)
RETURNS SETOF public.agent_tasks AS $$
  UPDATE public.agent_tasks
  SET
    status = 'running',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id IN (
    SELECT id FROM public.agent_tasks
    WHERE
      status = 'pending'
      AND scheduled_at <= NOW()
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY priority ASC, scheduled_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql;

COMMENT ON FUNCTION public.claim_next_agent_tasks IS
  'Atomically claim pending agent tasks for processing — safe for concurrent workers';
