-- Migration: Review Response System
-- Adds reviews table, content table for deliverables, and voice profiles

-- ============================================================
-- REVIEWS TABLE
-- Stores scraped reviews from Airbnb/Vrbo
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'airbnb', -- 'airbnb' | 'vrbo'
  external_review_id TEXT, -- platform's own ID if available
  reviewer_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  review_date TIMESTAMPTZ,
  has_host_response BOOLEAN NOT NULL DEFAULT false,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, external_review_id)
);

CREATE INDEX idx_reviews_property_id ON reviews(property_id);
CREATE INDEX idx_reviews_has_host_response ON reviews(has_host_response);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_scraped_at ON reviews(scraped_at DESC);

-- ============================================================
-- PROPERTIES TABLE
-- Core property record (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  property_type TEXT,
  location TEXT,
  listing_url TEXT,
  platform TEXT DEFAULT 'airbnb',
  active BOOLEAN NOT NULL DEFAULT true,
  subscription_tier TEXT NOT NULL DEFAULT 'free', -- 'free' | 'pro' | 'autopilot'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_properties_user_id ON properties(user_id);
CREATE INDEX idx_properties_subscription_tier ON properties(subscription_tier);
CREATE INDEX idx_properties_active ON properties(active);

-- ============================================================
-- VOICE PROFILES TABLE
-- Stores owner voice calibration from onboarding
-- ============================================================
CREATE TABLE IF NOT EXISTS voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_data JSONB NOT NULL DEFAULT '{}',
  -- profile_data shape:
  -- {
  --   tone: 'casual' | 'professional' | 'warm' | 'luxury',
  --   signOffName: string,
  --   alwaysUse: string,
  --   neverUse: string,
  --   personalityNotes: string
  -- }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- CONTENT TABLE
-- Stores all AI-generated deliverables (review responses, social posts, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'review_response' | 'social_post' | 'listing_rewrite' | 'guest_message'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'dismissed'
  title TEXT,
  body TEXT NOT NULL,
  sentiment TEXT, -- 'positive' | 'neutral' | 'negative' (for review_response type)
  is_negative BOOLEAN NOT NULL DEFAULT false, -- flag for negative reviews (UI red border)
  source_review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  -- metadata for review_response:
  -- {
  --   review_rating: number,
  --   review_date: string,
  --   reviewer_name: string,
  --   platform: string,
  --   original_review: string,
  --   generated_at: string
  -- }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  week_of TIMESTAMPTZ GENERATED ALWAYS AS (
    date_trunc('week', created_at)
  ) STORED
);

CREATE INDEX idx_content_property_id ON content(property_id);
CREATE INDEX idx_content_user_id ON content(user_id);
CREATE INDEX idx_content_type ON content(type);
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_source_review_id ON content(source_review_id);
CREATE INDEX idx_content_is_negative ON content(is_negative);
CREATE INDEX idx_content_created_at ON content(created_at DESC);
CREATE INDEX idx_content_week_of ON content(week_of);

-- ============================================================
-- RLS POLICIES
-- Users can only see their own content
-- ============================================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Properties: users can only CRUD their own
CREATE POLICY "Users manage own properties"
  ON properties FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Reviews: users can only read reviews for their properties
CREATE POLICY "Users read own property reviews"
  ON reviews FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE user_id = auth.uid()
    )
  );

-- Service role can insert reviews (scrapers run server-side)
CREATE POLICY "Service role manages reviews"
  ON reviews FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Voice profiles: own only
CREATE POLICY "Users manage own voice profile"
  ON voice_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Content: users see their own deliverables
CREATE POLICY "Users manage own content"
  ON content FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role can insert content (workers run server-side)
CREATE POLICY "Service role manages content"
  ON content FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

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

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voice_profiles_updated_at
  BEFORE UPDATE ON voice_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
