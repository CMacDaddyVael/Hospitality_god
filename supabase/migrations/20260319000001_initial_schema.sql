-- ============================================================
-- Hospitality God — Initial Schema Migration
-- 20260319000001_initial_schema.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search later

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE subscription_tier AS ENUM ('trial', 'starter', 'pro', 'agency');

CREATE TYPE platform_type AS ENUM ('airbnb', 'vrbo', 'booking_com', 'direct');

CREATE TYPE social_platform AS ENUM ('instagram', 'tiktok', 'facebook');

CREATE TYPE message_sequence_type AS ENUM ('pre_arrival', 'check_in', 'mid_stay', 'post_stay');

CREATE TYPE message_status AS ENUM ('draft', 'scheduled', 'sent', 'failed', 'cancelled');

CREATE TYPE content_status AS ENUM ('draft', 'scheduled', 'posted', 'failed', 'cancelled');

CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'done', 'failed');

CREATE TYPE task_type AS ENUM (
  'listing_analysis',
  'listing_rewrite',
  'review_response',
  'guest_message',
  'social_post',
  'health_score',
  'voice_calibration',
  'photo_analysis',
  'competitor_scan'
);

-- ============================================================
-- OWNERS TABLE
-- Linked to Supabase auth.users via id
-- ============================================================

CREATE TABLE owners (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL UNIQUE,
  stripe_customer_id  TEXT UNIQUE,
  subscription_tier   subscription_tier NOT NULL DEFAULT 'trial',
  trial_ends_at       TIMESTAMPTZ,
  voice_profile       JSONB DEFAULT '{}'::jsonb,
  -- voice_profile shape:
  -- {
  --   tone: 'casual' | 'professional' | 'warm' | 'luxury',
  --   sign_off_name: string,
  --   always_use: string[],
  --   never_use: string[],
  --   personality_notes: string,
  --   calibrated_at: ISO8601 string
  -- }
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROPERTIES TABLE
-- One row per listing (an owner can have many)
-- ============================================================

CREATE TABLE properties (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id             UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  platform             platform_type NOT NULL DEFAULT 'airbnb',
  external_listing_id  TEXT,                       -- e.g. Airbnb room ID
  address              TEXT,
  city                 TEXT,
  state                TEXT,
  country              TEXT DEFAULT 'US',
  latitude             DECIMAL(9,6),
  longitude            DECIMAL(9,6),
  amenities            JSONB DEFAULT '[]'::jsonb,  -- string array of amenity names
  photos               JSONB DEFAULT '[]'::jsonb,  -- array of { url, caption, order }
  raw_listing          JSONB DEFAULT '{}'::jsonb,  -- full scraped/API payload preserved
  listing_title        TEXT,
  listing_description  TEXT,
  property_type        TEXT,                        -- 'entire_home', 'private_room', etc.
  bedrooms             INTEGER,
  bathrooms            DECIMAL(3,1),
  max_guests           INTEGER,
  price_per_night      DECIMAL(10,2),
  currency             TEXT DEFAULT 'USD',
  avg_rating           DECIMAL(3,2),
  review_count         INTEGER DEFAULT 0,
  health_score         INTEGER,                     -- 0-100, computed by agent
  last_synced_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(owner_id, platform, external_listing_id)
);

-- ============================================================
-- REVIEWS TABLE
-- Reviews scraped from platforms + agent-drafted responses
-- ============================================================

CREATE TABLE reviews (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id          UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  platform             platform_type NOT NULL DEFAULT 'airbnb',
  external_review_id   TEXT,                        -- platform's review ID for dedup
  reviewer_name        TEXT NOT NULL,
  rating               INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body                 TEXT,
  posted_at            TIMESTAMPTZ NOT NULL,
  -- Agent output fields
  response_draft       TEXT,
  response_approved_at TIMESTAMPTZ,
  response_posted_at   TIMESTAMPTZ,
  sentiment_score      DECIMAL(4,3),                -- -1.0 to 1.0 (negative to positive)
  sentiment_label      TEXT,                        -- 'positive', 'neutral', 'negative'
  key_themes           JSONB DEFAULT '[]'::jsonb,   -- extracted topics ['cleanliness', 'location']
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(property_id, platform, external_review_id)
);

-- ============================================================
-- GUEST MESSAGES TABLE
-- Automated messaging sequences per guest stay
-- ============================================================

CREATE TABLE guest_messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id      UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_name       TEXT NOT NULL,
  guest_email      TEXT,
  thread_id        TEXT,                            -- platform thread/conversation ID
  reservation_id   TEXT,                            -- platform booking reference
  check_in_date    DATE,
  check_out_date   DATE,
  sequence_type    message_sequence_type NOT NULL,
  body             TEXT NOT NULL,
  scheduled_for    TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  status           message_status NOT NULL DEFAULT 'draft',
  delivery_method  TEXT DEFAULT 'airbnb',           -- 'airbnb', 'email', 'sms'
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONTENT POSTS TABLE
-- Social media posts created and scheduled by the agent
-- ============================================================

CREATE TABLE content_posts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  platform        social_platform NOT NULL,
  caption         TEXT NOT NULL,
  hashtags        JSONB DEFAULT '[]'::jsonb,        -- string array
  image_url       TEXT,
  image_urls      JSONB DEFAULT '[]'::jsonb,        -- multiple images for carousel
  media_type      TEXT DEFAULT 'image',             -- 'image', 'carousel', 'reel', 'video'
  scheduled_for   TIMESTAMPTZ,
  posted_at       TIMESTAMPTZ,
  external_post_id TEXT,                            -- platform post ID after publishing
  status          content_status NOT NULL DEFAULT 'draft',
  engagement      JSONB DEFAULT '{}'::jsonb,        -- { likes, comments, shares, reach }
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AGENT TASKS TABLE
-- Job queue for all autonomous agent work
-- ============================================================

CREATE TABLE agent_tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id  UUID REFERENCES properties(id) ON DELETE CASCADE,  -- nullable for owner-level tasks
  owner_id     UUID REFERENCES owners(id) ON DELETE CASCADE,      -- always set
  task_type    task_type NOT NULL,
  status       task_status NOT NULL DEFAULT 'pending',
  payload      JSONB DEFAULT '{}'::jsonb,            -- input data for the task
  result       JSONB DEFAULT '{}'::jsonb,            -- output data from the task
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error   TEXT,
  priority     INTEGER NOT NULL DEFAULT 5,           -- 1 (highest) to 10 (lowest)
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),           -- when to process (for delayed tasks)
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER owners_updated_at
  BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER guest_messages_updated_at
  BEFORE UPDATE ON guest_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER content_posts_updated_at
  BEFORE UPDATE ON content_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER agent_tasks_updated_at
  BEFORE UPDATE ON agent_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INDEXES
-- ============================================================

-- properties
CREATE INDEX idx_properties_owner_id ON properties(owner_id);
CREATE INDEX idx_properties_platform ON properties(platform);
CREATE INDEX idx_properties_external_listing_id ON properties(external_listing_id);
CREATE INDEX idx_properties_health_score ON properties(health_score);

-- reviews
CREATE INDEX idx_reviews_property_id ON reviews(property_id);
CREATE INDEX idx_reviews_posted_at ON reviews(posted_at DESC);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_sentiment_score ON reviews(sentiment_score);
CREATE INDEX idx_reviews_response_posted_at ON reviews(response_posted_at)
  WHERE response_posted_at IS NULL;  -- partial index for unresponded reviews

-- guest_messages
CREATE INDEX idx_guest_messages_property_id ON guest_messages(property_id);
CREATE INDEX idx_guest_messages_status ON guest_messages(status);
CREATE INDEX idx_guest_messages_scheduled_for ON guest_messages(scheduled_for)
  WHERE status = 'scheduled';
CREATE INDEX idx_guest_messages_sequence_type ON guest_messages(sequence_type);
CREATE INDEX idx_guest_messages_thread_id ON guest_messages(thread_id);

-- content_posts
CREATE INDEX idx_content_posts_property_id ON content_posts(property_id);
CREATE INDEX idx_content_posts_status ON content_posts(status);
CREATE INDEX idx_content_posts_scheduled_for ON content_posts(scheduled_for)
  WHERE status = 'scheduled';
CREATE INDEX idx_content_posts_platform ON content_posts(platform);

-- agent_tasks
CREATE INDEX idx_agent_tasks_property_id ON agent_tasks(property_id);
CREATE INDEX idx_agent_tasks_owner_id ON agent_tasks(owner_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_task_type ON agent_tasks(task_type);
CREATE INDEX idx_agent_tasks_scheduled_for ON agent_tasks(scheduled_for)
  WHERE status = 'pending';
CREATE INDEX idx_agent_tasks_priority_status ON agent_tasks(priority ASC, scheduled_for ASC)
  WHERE status = 'pending';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE owners         ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_posts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks    ENABLE ROW LEVEL SECURITY;

-- ---- owners ----
-- Users can only see and modify their own owner record
CREATE POLICY owners_select ON owners
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY owners_insert ON owners
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY owners_update ON owners
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No delete policy — owners cannot self-delete (require admin action)

-- ---- properties ----
CREATE POLICY properties_select ON properties
  FOR SELECT USING (
    owner_id = auth.uid()
  );

CREATE POLICY properties_insert ON properties
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
  );

CREATE POLICY properties_update ON properties
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY properties_delete ON properties
  FOR DELETE USING (owner_id = auth.uid());

-- ---- reviews ----
-- Access via property ownership
CREATE POLICY reviews_select ON reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = reviews.property_id
        AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY reviews_insert ON reviews
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = reviews.property_id
        AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY reviews_update ON reviews
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = reviews.property_id
        AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY reviews_delete ON reviews
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = reviews.property_id
        AND properties.owner_id = auth.uid()
    )
  );

-- ---- guest_messages ----
CREATE POLICY guest_messages_select ON guest_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = guest_messages.property_id
        AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY guest_messages_insert ON guest_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = guest_messages.property_id
        AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY guest_messages_update ON guest_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = guest_messages.property_id
        AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY guest_messages_delete ON guest_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = guest_messages.property_id
        AND properties.owner_id = auth.uid()
    )
  );

-- ---- content_posts ----
CREATE POLICY content_posts_select ON content_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = content_posts.property_id
        AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY content_posts_insert ON content_posts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = content_posts.property_id
        AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY content_posts_update ON content_posts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = content_posts.property_id
        AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY content_posts_delete ON content_posts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = content_posts.property_id
        AND properties.owner_id = auth.uid()
    )
  );

-- ---- agent_tasks ----
CREATE POLICY agent_tasks_select ON agent_tasks
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY agent_tasks_insert ON agent_tasks
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY agent_tasks_update ON agent_tasks
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY agent_tasks_delete ON agent_tasks
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================================
-- SERVICE ROLE BYPASS POLICIES
-- Backend workers (using service_role key) bypass RLS automatically.
-- These policies cover authenticated users (JWT from browser).
-- No additional grants needed — service_role bypasses RLS entirely.
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get all properties for the currently authenticated user
CREATE OR REPLACE FUNCTION get_my_properties()
RETURNS SETOF properties
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM properties WHERE owner_id = auth.uid();
$$;

-- Get pending agent tasks (used by worker polling)
-- NOTE: This function is designed to be called with service_role key
CREATE OR REPLACE FUNCTION get_pending_tasks(p_limit INTEGER DEFAULT 10)
RETURNS SETOF agent_tasks
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM agent_tasks
  WHERE status = 'pending'
    AND scheduled_for <= NOW()
    AND attempts < max_attempts
  ORDER BY priority ASC, scheduled_for ASC
  LIMIT p_limit;
$$;

-- Atomically claim a task for processing (prevents double-processing)
CREATE OR REPLACE FUNCTION claim_agent_task(p_task_id UUID)
RETURNS agent_tasks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task agent_tasks;
BEGIN
  UPDATE agent_tasks
  SET
    status = 'in_progress',
    started_at = NOW(),
    attempts = attempts + 1,
    updated_at = NOW()
  WHERE id = p_task_id
    AND status = 'pending'
  RETURNING * INTO v_task;

  RETURN v_task;
END;
$$;

-- Complete a task with result
CREATE OR REPLACE FUNCTION complete_agent_task(
  p_task_id UUID,
  p_result  JSONB DEFAULT '{}'::jsonb
)
RETURNS agent_tasks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task agent_tasks;
BEGIN
  UPDATE agent_tasks
  SET
    status = 'done',
    result = p_result,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_task_id
  RETURNING * INTO v_task;

  RETURN v_task;
END;
$$;

-- Fail a task with error (re-queues if attempts < max_attempts)
CREATE OR REPLACE FUNCTION fail_agent_task(
  p_task_id   UUID,
  p_error     TEXT
)
RETURNS agent_tasks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task agent_tasks;
  v_new_status task_status;
BEGIN
  -- Check if we should retry or permanently fail
  SELECT
    CASE WHEN attempts >= max_attempts THEN 'failed'::task_status
         ELSE 'pending'::task_status
    END
  INTO v_new_status
  FROM agent_tasks WHERE id = p_task_id;

  UPDATE agent_tasks
  SET
    status = v_new_status,
    last_error = p_error,
    -- Exponential backoff: reschedule 2^attempts minutes in the future
    scheduled_for = CASE
      WHEN v_new_status = 'pending'
      THEN NOW() + (POWER(2, attempts) * INTERVAL '1 minute')
      ELSE scheduled_for
    END,
    updated_at = NOW()
  WHERE id = p_task_id
  RETURNING * INTO v_task;

  RETURN v_task;
END;
$$;
