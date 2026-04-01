-- ============================================================
-- Hospitality God — MVP Schema
-- Migration: 20260319000001_mvp_schema
-- ============================================================

-- Enable pgcrypto for uuid generation (already available in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS TABLE
-- Mirrors auth.users with extra profile data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'Public user profiles mirroring auth.users';

-- ============================================================
-- PROPERTIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.properties (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name              TEXT,
  airbnb_url        TEXT,
  vrbo_url          TEXT,
  instagram_handle  TEXT,
  website_url       TEXT,
  location          TEXT,
  property_type     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.properties IS 'STR properties owned by users';
CREATE INDEX idx_properties_user_id ON public.properties(user_id);

-- ============================================================
-- LISTINGS TABLE
-- Scraped/cached listing data per property
-- ============================================================
CREATE TABLE IF NOT EXISTS public.listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('airbnb', 'vrbo', 'other')),
  external_id     TEXT,
  title           TEXT,
  description     TEXT,
  photos          JSONB DEFAULT '[]'::JSONB,
  amenities       JSONB DEFAULT '[]'::JSONB,
  price_per_night NUMERIC(10,2),
  rating          NUMERIC(3,2),
  review_count    INTEGER DEFAULT 0,
  raw_data        JSONB,
  scraped_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.listings IS 'Scraped listing data from Airbnb, Vrbo, etc.';
CREATE INDEX idx_listings_property_id ON public.listings(property_id);

-- ============================================================
-- AUDITS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  raw_scrape_json JSONB,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audits IS 'Audit jobs — one per analysis run for a property';
CREATE INDEX idx_audits_property_id ON public.audits(property_id);
CREATE INDEX idx_audits_status      ON public.audits(status);

-- ============================================================
-- AUDIT SCORES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id          UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  total_score       SMALLINT NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  category_scores   JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- expected shape:
  -- {
  --   "photos":      { "score": 0-100, "notes": "..." },
  --   "title":       { "score": 0-100, "notes": "..." },
  --   "description": { "score": 0-100, "notes": "..." },
  --   "amenities":   { "score": 0-100, "notes": "..." },
  --   "reviews":     { "score": 0-100, "notes": "..." },
  --   "pricing":     { "score": 0-100, "notes": "..." }
  -- }
  recommendations   JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- expected shape: [{ "priority": "high|medium|low", "category": "...", "action": "...", "impact": "..." }]
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_scores IS 'Scored results for each audit run';
CREATE UNIQUE INDEX idx_audit_scores_audit_id ON public.audit_scores(audit_id);

-- ============================================================
-- CONTENT ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.content_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'social_post',
                'listing_title',
                'listing_description',
                'review_response',
                'seasonal_copy',
                'guest_message'
              )),
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  body        TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- metadata examples:
  --   social_post:        { "platform": "instagram", "hashtags": [...], "image_url": "..." }
  --   listing_title:      { "platform": "airbnb", "character_count": 50 }
  --   review_response:    { "review_id": "...", "reviewer_name": "...", "rating": 5 }
  --   seasonal_copy:      { "season": "winter", "applies_from": "2026-12-01", "applies_to": "2027-01-31" }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.content_items IS 'AI-generated content deliverables for properties';
CREATE INDEX idx_content_items_property_id ON public.content_items(property_id);
CREATE INDEX idx_content_items_status      ON public.content_items(status);
CREATE INDEX idx_content_items_type        ON public.content_items(type);

-- ============================================================
-- REVIEW RESPONSES TABLE
-- Tracks which reviews have been responded to
-- ============================================================
CREATE TABLE IF NOT EXISTS public.review_responses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  content_item_id     UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
  platform            TEXT NOT NULL CHECK (platform IN ('airbnb', 'vrbo', 'google', 'other')),
  external_review_id  TEXT,
  reviewer_name       TEXT,
  review_text         TEXT,
  review_rating       SMALLINT CHECK (review_rating BETWEEN 1 AND 5),
  review_date         TIMESTAMPTZ,
  response_status     TEXT NOT NULL DEFAULT 'pending'
                        CHECK (response_status IN ('pending', 'drafted', 'approved', 'posted')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.review_responses IS 'Review tracking and response workflow';
CREATE INDEX idx_review_responses_property_id ON public.review_responses(property_id);

-- ============================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  status                  TEXT NOT NULL DEFAULT 'trialing'
                            CHECK (status IN (
                              'trialing', 'active', 'past_due',
                              'canceled', 'unpaid', 'incomplete'
                            )),
  plan                    TEXT NOT NULL DEFAULT 'free'
                            CHECK (plan IN ('free', 'pro', 'autopilot')),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.subscriptions IS 'Stripe subscription records per user';
CREATE UNIQUE INDEX idx_subscriptions_user_id           ON public.subscriptions(user_id);
CREATE UNIQUE INDEX idx_subscriptions_stripe_sub_id     ON public.subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audits_updated_at
  BEFORE UPDATE ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_content_items_updated_at
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_review_responses_updated_at
  BEFORE UPDATE ON public.review_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_scores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_responses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions     ENABLE ROW LEVEL SECURITY;

-- ---- users ----
CREATE POLICY "users: select own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users: insert own"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users: update own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---- properties ----
CREATE POLICY "properties: select own"
  ON public.properties FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "properties: insert own"
  ON public.properties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "properties: update own"
  ON public.properties FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "properties: delete own"
  ON public.properties FOR DELETE
  USING (auth.uid() = user_id);

-- ---- listings ----
CREATE POLICY "listings: select own"
  ON public.listings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = listings.property_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "listings: insert own"
  ON public.listings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = listings.property_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "listings: update own"
  ON public.listings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = listings.property_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "listings: delete own"
  ON public.listings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = listings.property_id
        AND p.user_id = auth.uid()
    )
  );

-- ---- audits ----
CREATE POLICY "audits: select own"
  ON public.audits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = audits.property_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "audits: insert own"
  ON public.audits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = audits.property_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "audits: update own"
  ON public.audits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = audits.property_id
        AND p.user_id = auth.uid()
    )
  );

-- ---- audit_scores ----
CREATE POLICY "audit_scores: select own"
  ON public.audit_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.audits a
      JOIN public.properties p ON p.id = a.property_id
      WHERE a.id = audit_scores.audit_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "audit_scores: insert own"
  ON public.audit_scores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.audits a
      JOIN public.properties p ON p.id = a.property_id
      WHERE a.id = audit_scores.audit_id
        AND p.user_id = auth.uid()
    )
  );

-- ---- content_items ----
CREATE POLICY "content_items: select own"
  ON public.content_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = content_items.property_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "content_items: insert own"
  ON public.content_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = content_items.property_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "content_items: update own"
  ON public.content_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = content_items.property_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "content_items: delete own"
  ON public.content_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = content_items.property_id
        AND p.user_id = auth.uid()
    )
  );

-- ---- review_responses ----
CREATE POLICY "review_responses: select own"
  ON public.review_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = review_responses.property_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "review_responses: insert own"
  ON public.review_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = review_responses.property_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "review_responses: update own"
  ON public.review_responses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = review_responses.property_id
        AND p.user_id = auth.uid()
    )
  );

-- ---- subscriptions ----
CREATE POLICY "subscriptions: select own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "subscriptions: insert own"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions: update own"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- SERVICE ROLE BYPASS
-- Allow server-side code (scraper, scorer, content generator)
-- to write rows on behalf of users via the service role key.
-- These policies only apply when role = 'service_role'.
-- ============================================================

CREATE POLICY "service: all on properties"
  ON public.properties FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service: all on listings"
  ON public.listings FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service: all on audits"
  ON public.audits FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service: all on audit_scores"
  ON public.audit_scores FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service: all on content_items"
  ON public.content_items FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service: all on review_responses"
  ON public.review_responses FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service: all on subscriptions"
  ON public.subscriptions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service: all on users"
  ON public.users FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
